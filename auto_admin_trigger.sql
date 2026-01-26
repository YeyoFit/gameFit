-- AUTO-ADMIN MODE
-- Ejecuta esto para que CUALQUIER USUARIO NUEVO sea Admin automáticamente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'admin'); -- <-- CAMBIADO A 'admin'
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
