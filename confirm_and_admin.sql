-- 1. Confirmar Email automáticamente (para no necesitar link)
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;

-- 2. Convertir a todos los usuarios actuales en ADMIN (para que puedas probar todo)
UPDATE public.profiles
SET role = 'admin';
