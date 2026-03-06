ALTER TABLE spreadsheets
ADD COLUMN day_of_week TEXT CHECK (day_of_week IN ('lunes', 'martes', 'sabado'));
