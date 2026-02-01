/**
 * Web app: write (ESP) and read (dashboard).
 * - GET ?temp=25&hum=60&batt=87 → append row, return "OK"
 * - GET ?action=read            → return sheet data as JSON
 * Deploy as Web app, Execute as me, Who has access: Anyone.
 */
function doGet(e) {
  e = e || {};
  var params = e.parameter || {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // ===== READ MODE =====
  var wantRead =
    params.action === 'read' ||
    params.Action === 'read' ||
    (!params.temp && !params.hum);

  if (wantRead) {
    var data = sheet.getDataRange().getValues();
    if (!data.length) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var firstCell = data[0][0];
    var noHeaderRow =
      firstCell instanceof Date ||
      (typeof firstCell === 'number' && !isNaN(firstCell));

    var headers = noHeaderRow
      ? ['Timestamp', 'Temperature', 'Humidity', 'Battery']
      : data[0];

    var startRow = noHeaderRow ? 0 : 1;
    var out = [];

    for (var i = startRow; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        var val = data[i][j];
        if (val instanceof Date) val = val.toISOString();
        row[headers[j]] = val;
      }
      out.push(row);
    }

    return ContentService
      .createTextOutput(JSON.stringify(out))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ===== WRITE MODE =====
  var temp = params.temp;
  var hum  = params.hum;
  var batt = params.batt;

  if (!temp || !hum) {
    return ContentService
      .createTextOutput('Missing parameters')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  sheet.appendRow([
    new Date(),
    Number(temp),
    Number(hum),
    batt !== undefined ? Number(batt) : ''
  ]);

  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
