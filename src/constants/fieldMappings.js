module.exports = {
  STATE_FARM: [
    {
      csvField: 'TIV',
      dbField: 'tiv',
      isRequired: true,
      fieldType: 'number',
    },
    {
      csvField: 'Line of Business',
      dbField: 'lineOfBusiness',
      isRequired: false,
      fieldType: 'string',
    },
    {
      csvField: 'State',
      dbField: 'addressState',
      isRequired: true,
      fieldType: 'string',
    },
    {
      csvField: 'County',
      dbField: 'addressCounty',
      isRequired: true,
      fieldType: 'string',
    },
    {
      csvField: 'PostalCode',
      dbField: 'addressZip',
      isRequired: true,
      fieldType: 'string', // string for now in case of Canada or other non-US countries
    },
    {
      csvField: 'Address',
      dbField: 'addressStreet',
      isRequired: true,
      fieldType: 'string',
    },
    {
      csvField: 'City',
      dbField: 'addressCity',
      isRequired: true,
      fieldType: 'string',
    },
    {
      csvField: 'Latitude',
      dbField: 'latitue',
      isRequired: false,
      fieldType: 'number',
    },
    {
      csvField: 'Longitude',
      dbField: 'longitude',
      isRequired: false,
      fieldType: 'number',
    },
    {
      csvField: 'All rate',
      dbField: 'allRate',
      isRequired: false,
      fieldType: 'string',
    },
  ],
};
