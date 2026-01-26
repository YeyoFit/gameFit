-- CONFIRMAR TODOS LOS EMAILS PENDIENTES
-- Ejecuta esto para saltarte el paso de verificar el correo.

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
