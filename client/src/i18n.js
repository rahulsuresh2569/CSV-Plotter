const translations = {
  en: {
    // App header
    appTitle: 'CSV Plotter',
    appSubtitle: 'Upload a CSV file, select columns, and visualize your data',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',

    // FileUpload
    fileSizeError: 'This file exceeds the 10 MB limit. Please upload a smaller file.',
    fileTypeError: 'Please upload a file in CSV format (.csv).',
    parsingFile: 'Parsing file...',
    dropToReplace: 'Drop a new file or click to replace',
    dragDropPrompt: 'Drag & drop a CSV file here, or click to browse',
    fileHint: '.csv files up to 10 MB',

    // StatusBar
    errorHintSettings: 'Try adjusting the parsing settings below, or upload a different file.',
    errorHintGeneric: 'Please check the file format and try uploading again.',
    infoFile: 'File',
    infoRows: 'Rows',
    infoColumns: 'Columns',
    infoDelimiter: 'Delimiter',
    infoDecimal: 'Decimal',
    infoHeaderRow: 'Header row',
    infoCommentLines: 'Comment lines',
    skipped: 'skipped',
    delimiterSemicolon: 'Semicolon (;)',
    delimiterComma: 'Comma (,)',
    delimiterTab: 'Tab',
    decimalComma: 'Comma (,)',
    decimalDot: 'Dot (.)',
    yes: 'Yes',
    no: 'No',

    // ParsingSettings
    parsingSettings: 'Parsing Settings',
    labelDelimiter: 'Delimiter',
    labelDecimalSeparator: 'Decimal separator',
    labelFirstRowHeader: 'First row is header',
    autoDetected: 'Auto (detected:',
    optionComma: 'Comma (,)',
    optionSemicolon: 'Semicolon (;)',
    optionTab: 'Tab',
    optionDot: 'Dot (.)',
    apply: 'Apply',
    resetToAuto: 'Reset to Auto',
    detectedSemicolon: 'Semicolon',
    detectedComma: 'Comma',
    detectedTab: 'Tab',
    detectedDot: 'Dot',

    // DataPreview
    dataPreview: 'Data Preview',
    rowsShown: 'rows shown',
    noHeaderDetected: 'No header row was detected \u2014 column names were auto-generated. Click any column header to rename it.',
    clickToRename: 'Click to rename',

    // ColumnSelector
    xAxis: 'X-Axis',
    yAxis: 'Y-Axis',
    nonNumericHint: 'Non-numeric columns cannot be used for Y-axis',
    selectNumericHint: 'Select at least one numeric column to plot',
    selectAll: 'Select all',

    // ChartView
    chartLine: 'Line',
    chartScatter: 'Scatter',
    chartBar: 'Bar',
    exportPng: 'Export PNG',
    fullscreen: 'Fullscreen',
    range: 'Range',
    rangeHint: 'Drag the handles or the bar to select a row range',
    exitFullscreen: 'Exit fullscreen',
    from: 'From',
    to: 'To',
    first: 'First',
    last: 'Last',
    all: 'All',
    of: 'of',

    // Sample data
    trySample: 'Or try a sample file:',

    // Empty state
    emptyStateHint: 'Upload a CSV file or try a sample to get started',

    // Column override
    overrideOffer: "Column \"{name}\" has {numeric} numeric values out of {total} rows but is classified as text.",
    overrideActive: "Column \"{name}\" is being plotted as numeric — {bad} non-numeric values appear as gaps.",
    plotAnyway: 'Plot anyway',
    undoOverride: 'Undo',
    overridden: 'overridden',
    stringColumnsInfo: 'Non-numeric columns cannot be plotted on the Y-axis: {names}.',

    // Toast
    parseSuccess: 'File parsed successfully',
    rows: 'rows',
  },

  de: {
    // App header
    appTitle: 'CSV Plotter',
    appSubtitle: 'CSV-Datei hochladen, Spalten ausw\u00e4hlen und Daten visualisieren',
    switchToLight: 'Zum hellen Modus wechseln',
    switchToDark: 'Zum dunklen Modus wechseln',

    // FileUpload
    fileSizeError: 'Diese Datei \u00fcberschreitet das 10-MB-Limit. Bitte eine kleinere Datei hochladen.',
    fileTypeError: 'Bitte eine Datei im CSV-Format (.csv) hochladen.',
    parsingFile: 'Datei wird verarbeitet...',
    dropToReplace: 'Neue Datei ablegen oder klicken, um zu ersetzen',
    dragDropPrompt: 'CSV-Datei hierher ziehen oder klicken zum Durchsuchen',
    fileHint: '.csv-Dateien bis 10 MB',

    // StatusBar
    errorHintSettings: 'Versuchen Sie, die Parsing-Einstellungen unten anzupassen, oder laden Sie eine andere Datei hoch.',
    errorHintGeneric: 'Bitte \u00fcberpr\u00fcfen Sie das Dateiformat und versuchen Sie es erneut.',
    infoFile: 'Datei',
    infoRows: 'Zeilen',
    infoColumns: 'Spalten',
    infoDelimiter: 'Trennzeichen',
    infoDecimal: 'Dezimalzeichen',
    infoHeaderRow: 'Kopfzeile',
    infoCommentLines: 'Kommentarzeilen',
    skipped: '\u00fcbersprungen',
    delimiterSemicolon: 'Semikolon (;)',
    delimiterComma: 'Komma (,)',
    delimiterTab: 'Tabulator',
    decimalComma: 'Komma (,)',
    decimalDot: 'Punkt (.)',
    yes: 'Ja',
    no: 'Nein',

    // ParsingSettings
    parsingSettings: 'Parsing-Einstellungen',
    labelDelimiter: 'Trennzeichen',
    labelDecimalSeparator: 'Dezimaltrennzeichen',
    labelFirstRowHeader: 'Erste Zeile ist Kopfzeile',
    autoDetected: 'Auto (erkannt:',
    optionComma: 'Komma (,)',
    optionSemicolon: 'Semikolon (;)',
    optionTab: 'Tabulator',
    optionDot: 'Punkt (.)',
    apply: 'Anwenden',
    resetToAuto: 'Auf Auto zur\u00fccksetzen',
    detectedSemicolon: 'Semikolon',
    detectedComma: 'Komma',
    detectedTab: 'Tabulator',
    detectedDot: 'Punkt',

    // DataPreview
    dataPreview: 'Datenvorschau',
    rowsShown: 'Zeilen angezeigt',
    noHeaderDetected: 'Keine Kopfzeile erkannt \u2014 Spaltennamen wurden automatisch generiert. Klicken Sie auf einen Spaltennamen, um ihn umzubenennen.',
    clickToRename: 'Klicken zum Umbenennen',

    // ColumnSelector
    xAxis: 'X-Achse',
    yAxis: 'Y-Achse',
    nonNumericHint: 'Nicht-numerische Spalten k\u00f6nnen nicht f\u00fcr die Y-Achse verwendet werden',
    selectNumericHint: 'Mindestens eine numerische Spalte zum Plotten ausw\u00e4hlen',
    selectAll: 'Alle ausw\u00e4hlen',

    // ChartView
    chartLine: 'Linie',
    chartScatter: 'Punkte',
    chartBar: 'Balken',
    exportPng: 'PNG exportieren',
    fullscreen: 'Vollbild',
    range: 'Bereich',
    rangeHint: 'Ziehen Sie die Griffe oder den Balken, um einen Zeilenbereich auszuw\u00e4hlen',
    exitFullscreen: 'Vollbild beenden',
    from: 'Von',
    to: 'Bis',
    first: 'Erste',
    last: 'Letzte',
    all: 'Alle',
    of: 'von',

    // Sample data
    trySample: 'Oder eine Beispieldatei testen:',

    // Empty state
    emptyStateHint: 'CSV-Datei hochladen oder ein Beispiel ausprobieren',

    // Column override
    overrideOffer: "Spalte \"{name}\" hat {numeric} numerische Werte von {total} Zeilen, wird aber als Text eingestuft.",
    overrideActive: "Spalte \"{name}\" wird als numerisch geplottet \u2014 {bad} nicht-numerische Werte erscheinen als L\u00fccken.",
    plotAnyway: 'Trotzdem plotten',
    undoOverride: 'R\u00fcckg\u00e4ngig',
    overridden: '\u00fcberschrieben',
    stringColumnsInfo: 'Nicht-numerische Spalten k\u00f6nnen nicht auf der Y-Achse geplottet werden: {names}.',

    // Toast
    parseSuccess: 'Datei erfolgreich verarbeitet',
    rows: 'Zeilen',
  },
}

export default translations
