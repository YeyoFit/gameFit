-- 1. Obtener el ID del usuario por su email
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'prueba1@xx.com';
  
  IF target_user_id IS NOT NULL THEN
    -- 2. Insertar o Actualizar (Upsert) el perfil para asegurar que existe y es admin
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, 'prueba1@xx.com', 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  END IF;
END $$;
