-- MASTER FIX FOR REGISTRATION AND LOGIN
-- Run this script in the Supabase SQL Editor

-- 1. ASEGURAR RELACIÓN DE CLAVES FORÁNEAS
-- A veces esto falta y causa problemas en cascada
ALTER TABLE IF EXISTS public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 2. LIMPIEZA DE POLÍTICAS (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Borrar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can do anything on profiles" ON public.profiles;

-- 3. NUEVAS POLÍTICAS ROBUSTAS

-- A. LECTURA (SELECT)
-- - Todo el mundo puede ver su propio perfil
-- - Admins y Super Admins pueden ver TODOS los perfiles
CREATE POLICY "View Profiles Policy" ON public.profiles
FOR SELECT USING (
  -- Usuario ve el suyo
  auth.uid() = id
  OR 
  -- Admin/SuperAdmin ven todos (Consulta directa para evitar recursión infinita de RLS)
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
);

-- B. INSERCIÓN (INSERT)
-- - Permitir a cualquiera insertar su propio perfil (necesario para el trigger de registro)
-- - Permitir a Service Role (Admin API) insertar
CREATE POLICY "Insert Profiles Policy" ON public.profiles
FOR INSERT WITH CHECK (
  auth.uid() = id
);

-- C. ACTUALIZACIÓN (UPDATE)
-- - Usuario actualiza el suyo
-- - Super Admin actualiza todos
CREATE POLICY "Update Profiles Policy" ON public.profiles
FOR UPDATE USING (
  -- Usuario actualiza el suyo
  auth.uid() = id
  OR
  -- Super Admin actualiza todos
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- D. BORRADO (DELETE)
-- - Solo Super Admin puede borrar
CREATE POLICY "Delete Profiles Policy" ON public.profiles
FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- 4. FUNCIÓN SEGURA PARA OBTENER ROL (Bypassing RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  _role text;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RETURN null;
  END IF;

  -- Seleccionar directo (SECURITY DEFINER salta RLS)
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  
  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role TO anon;

-- 5. ASEGURAR SUPER ADMIN
-- Forzar que mazomalote@gmail.com sea super_admin
DO $$
DECLARE
  target_email text := 'mazomalote@gmail.com';
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  
  IF target_user_id IS NOT NULL THEN
    -- Upsert perfil
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, target_email, 'super_admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin';
    
    RAISE NOTICE 'CONFIRMADO: % es ahora SUPER_ADMIN', target_email;
  ELSE
    RAISE NOTICE 'AVISO: El usuario % no existe en auth.users todavía.', target_email;
  END IF;
END $$;
