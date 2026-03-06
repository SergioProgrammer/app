ALTER TABLE spreadsheet_rows
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS incoterm text;

UPDATE spreadsheet_rows r
SET
  awb = COALESCE(r.awb, s.header_data->>'awb'),
  flight_number = COALESCE(r.flight_number, s.header_data->>'flightNumber'),
  invoice_number = COALESCE(r.invoice_number, s.header_data->>'invoiceNumber'),
  invoice_date = COALESCE(r.invoice_date, s.header_data->>'invoiceDate'),
  destination = COALESCE(r.destination, s.header_data->>'destination'),
  incoterm = COALESCE(r.incoterm, s.header_data->>'incoterm')
FROM spreadsheets s
WHERE r.spreadsheet_id = s.id
  AND (
    r.awb IS NULL
    OR r.flight_number IS NULL
    OR r.invoice_number IS NULL
    OR r.invoice_date IS NULL
    OR r.destination IS NULL
    OR r.incoterm IS NULL
  );

ALTER TABLE spreadsheet_rows
  DROP COLUMN IF EXISTS order_number,
  DROP COLUMN IF EXISTS line;
