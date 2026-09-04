-- Starter services and business hours so booking works out of the box.
-- Edit or replace these rows for the real service menu and schedule.
insert into services (name, description, duration_minutes, price_cents, loyalty_points) values
  ('Classic Manicure', 'Shape, cuticle care, polish.', 30, 3500, 35),
  ('Gel Manicure', 'Shape, cuticle care, gel polish.', 45, 4500, 45),
  ('Classic Pedicure', 'Soak, shape, cuticle care, polish.', 45, 4500, 45),
  ('Gel Pedicure', 'Soak, shape, cuticle care, gel polish.', 60, 5500, 55),
  ('Full Set Acrylic', 'Sculpted acrylic full set with polish.', 90, 7500, 75);

-- Tuesday - Saturday, 10am - 6pm.
insert into business_hours (day_of_week, start_time, end_time) values
  (2, '10:00', '18:00'),
  (3, '10:00', '18:00'),
  (4, '10:00', '18:00'),
  (5, '10:00', '18:00'),
  (6, '10:00', '17:00');
