-- 1. Restablecer el trigger para que los nuevos usuarios sean 'user' normal
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Convertir a 'mazomalote@gmail.com' en SUPER ADMIN
DO $$
DECLARE
  target_email text := 'mazomalote@gmail.com';
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  
  IF target_user_id IS NOT NULL THEN
    -- Upsert para convertir a SUPER_ADMIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, target_email, 'super_admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin';
    RAISE NOTICE 'Success: % is now SUPER_ADMIN', target_email;
  ELSE
    RAISE NOTICE 'Error: User % not found. The browser agent might have failed to create it. check auth.users table.', target_email;
  END IF;
END $$;
