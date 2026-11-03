INSERT INTO public.user_roles (user_id, role)
VALUES ('43245be5-8b9e-4f46-a763-28d0b6aaf6b4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;