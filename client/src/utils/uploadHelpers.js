//uploadHelpers.js: helper logic for the upload flow in App.jsx

//Find,remove non-numeric columns warnings,return it as an error instead
//The chart cannot render without numeric columns -> so this warning is an error
export function promoteNoNumericWarning(result) {
  const warnings = result.warnings || []
  for (let i = 0; i < warnings.length; i++) {
    if (warnings[i] && warnings[i].key === 'warningNoNumericColumns') {
      warnings.splice(i, 1)
      return { code: 'NO_NUMERIC_COLUMNS', fallback: 'No numeric columns found.' }
    }
  }
  return null
}
