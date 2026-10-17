// En EAS el archivo llega por el secret GOOGLE_SERVICES_JSON (tipo file);
// en local se usa el google-services.json que está ignorado por git.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
