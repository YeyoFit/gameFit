-- Actualizar el rol de tu usuario a ADMIN
UPDATE public.profiles
SET role = 'admin'
FROM auth.users
WHERE profiles.id = auth.users.id
AND auth.users.email = 'prueba1@xx.com';
