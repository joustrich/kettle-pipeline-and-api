const fastCsv = require('fast-csv');
const clientRepository = require('../repositories/clientRepository');
const pipelineJobRepository = require('../repositories/pipelineJobRepository');
const propertyRepository = require('../repositories/propertyRepository');
const geocodeService = require('../services/geocodeService');
const s3Service = require('../services/s3Service');
const FIELD_MAPPINGS = require('../constants/fieldMappings');
const { COMPLETE, COMPLETE_WITH_ERRORS, IN_PROGRESS } = require('../constants/pipelineJobStatuses');
const DYNAMO_MAX_BATCH_SIZE = 25;

function validateCsvFile(s3Key) {
  if (s3Key.split('/').length !== 2) {
    throw new Error(`Invalid s3Key: ${s3Key}. Format must be {clientId}/{filename}`);
  }

  const [clientId, filename] = s3Key.split('/');
  const clientFieldMappings = FIELD_MAPPINGS[clientId];
  if (!clientFieldMappings) {
    throw new Error(`Missing CSV field mappings for client ${clientId}`);
  }

  if (!filename.endsWith('.csv')) {
    throw new Error(`Invalid file ${filename}. File must be a CSV.`);
  }

  return { clientId, filename };
}

function validateCsvRow(row, clientId) {
  let isValidRow = true;
  const clientFieldMappings = FIELD_MAPPINGS[clientId];
  clientFieldMappings.forEach((fieldMapping) => {
    const value = row[fieldMapping.csvField];
    if (fieldMapping.isRequired && !value) {
      isValidRow = false;
    } else if (value && fieldMapping.fieldType === 'number' && isNaN(value)) {
      isValidRow = false;
    }
  });
  return isValidRow;
}

function transformCsvRow(row, clientId, jobId, csvBatchNumber, cb) {
  setImmediate(async () => {
    const transformedRow = {};
    const clientFieldMappings = FIELD_MAPPINGS[clientId];
    clientFieldMappings.forEach((fieldMapping) => {
      const value = row[fieldMapping.csvField];
      if (value) {
        const transformedValue = fieldMapping.fieldType === 'number' ? parseFloat(value) : value;
        transformedRow[fieldMapping.dbField] = transformedValue;
      }
    });

    if (!transformedRow.latitude || !transformedRow.longitude) {
      const { addressStreet, addressCity, addressState, addressZip } = transformedRow;
      const address = `${addressStreet} ${addressCity}, ${addressState} ${addressZip}`;
      const { latitude, longitude, geohash } = await geocodeService.geocodeAddress(address);
      transformedRow.latitude = latitude;
      transformedRow.longitude = longitude;
      transformedRow.hashKey = `${clientId}:PROPERTY`;
      transformedRow.sortKey = geohash;
      transformedRow.createdAt = new Date().toISOString();
      transformedRow.jobId = jobId;
      transformedRow.jobBatchNumber = csvBatchNumber;
    }

    cb(null, transformedRow);
  });
}

function getClients() {
  return clientRepository.getClients();
}

function getJobsForClient(clientId) {
  return pipelineJobRepository.getJobsForClient(clientId);
}

function csvUploadUrl(clientId) {
  return s3Service.getS3PutUrl(clientId);
}

async function validateAndBatchCsv(s3Bucket, s3Key) {
  const { clientId, filename } = validateCsvFile(s3Key);
  const csvString = await s3Service.getCsv(s3Bucket, s3Key);

  const invalidRows = [];
  const csvBatches = [[]];
  const csvStream = fastCsv
    .parse({ headers: true })
    .validate((row) => validateCsvRow(row, clientId))
    .on('error', (error) => {
      console.error('error parsing csv', error.stack);
      throw error;
    })
    .on('data', (row) => {
      const currentBatch = csvBatches[csvBatches.length - 1];
      currentBatch.push(row);
      if (currentBatch.length >= process.env.batchSize) {
        csvBatches.push([]);
      }
    })
    .on('data-invalid', (row, rowNumber) => {
      invalidRows.push(rowNumber);
    });

  const parsingDone = new Promise((resolve) => {
    csvStream.on('end', (numRows) => resolve(numRows));
  });

  csvStream.write(csvString);
  csvStream.end();

  const numRows = await parsingDone;
  const jobId = filename.split('.csv')[0];
  const isValidationError = invalidRows.length > 0;
  await pipelineJobRepository.createJob(clientId, jobId, numRows, isValidationError, invalidRows);
  if (!isValidationError) {
    const batchPromises = [];
    csvBatches.forEach((csvBatch, csvBatchIndex) => {
      if (csvBatch.length > 0) {
        const batchNumber = csvBatchIndex + 1;
        batchPromises.push(
          fastCsv.writeToString(csvBatch, { headers: true }).then((csvString) => {
            const batchFilename = `${clientId}/${jobId}_Batch_${batchNumber}.csv`;
            const s3Promise = s3Service.saveCsv(process.env.batchCsvBucket, batchFilename, csvString);
            const dynamoPromise = pipelineJobRepository.createJobBatch(clientId, jobId, batchNumber, csvBatch.length);
            return Promise.all([s3Promise, dynamoPromise]);
          }),
        );
      }
    });
    await Promise.all(batchPromises);
  }
}

async function processCsv(s3Bucket, s3Key) {
  const { clientId, filename } = validateCsvFile(s3Key);
  const csvString = await s3Service.getCsv(s3Bucket, s3Key);
  const [jobId, csvBatchNumberStr] = filename.split('.csv')[0].split('_Batch_');
  const csvBatchNumber = parseInt(csvBatchNumberStr, 10);

  const dynamoBatches = [[]];
  const dynamoPromises = [];
  const csvStream = fastCsv
    .parse({ headers: true })
    .transform((row, cb) => transformCsvRow(row, clientId, jobId, csvBatchNumber, cb))
    .on('error', (error) => {
      throw error;
    })
    .on('data', (row) => {
      const currentBatch = dynamoBatches[dynamoBatches.length - 1];
      currentBatch.push(row);
      if (currentBatch.length === DYNAMO_MAX_BATCH_SIZE) {
        dynamoBatches.push([]);
        dynamoPromises.push(propertyRepository.batchWriteProperties(currentBatch));
      }
    });

  csvStream.write(csvString);
  csvStream.end();

  const parsingDone = new Promise((resolve) => {
    csvStream.on('end', (numRows) => resolve(numRows));
  });

  await parsingDone;

  // If last batch is less than the max batch size, we won't have sent it to dynamo yet
  const currentBatch = dynamoBatches[dynamoBatches.length - 1];
  if (currentBatch.length < DYNAMO_MAX_BATCH_SIZE) {
    dynamoPromises.push(propertyRepository.batchWriteProperties(currentBatch));
  }
  const allResults = await Promise.all(dynamoPromises);
  const allUnprocessedItems = [];
  allResults.forEach((dynamoResult) => {
    if (!dynamoResult.success) {
      allUnprocessedItems.push(...dynamoResult.unprocessedItems);
    }
  });
  const status = allUnprocessedItems.length > 0 ? COMPLETE_WITH_ERRORS : COMPLETE;
  await pipelineJobRepository.updateJobBatch(clientId, jobId, csvBatchNumber, status);

  // If this is the last batch to finish, update the job
  const allJobBatches = await pipelineJobRepository.getJobBatchesForJob(clientId, jobId);
  const inProgressJobBatches = allJobBatches.filter((jobBatch) => jobBatch.jobStatus === IN_PROGRESS);
  if (inProgressJobBatches.length === 0) {
    const errorJobBatches = allJobBatches.filter((jobBatch) => jobBatch.jobStatus === COMPLETE_WITH_ERRORS);
    const overallJobStatus = errorJobBatches.length > 0 ? COMPLETE_WITH_ERRORS : COMPLETE;
    await pipelineJobRepository.updateJob(clientId, jobId, overallJobStatus);
  }
}

module.exports = {
  getClients,
  getJobsForClient,
  csvUploadUrl,
  validateAndBatchCsv,
  processCsv,
};
