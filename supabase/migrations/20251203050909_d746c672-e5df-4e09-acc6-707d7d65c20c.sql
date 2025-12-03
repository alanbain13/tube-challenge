-- Allow admins to insert badges
CREATE POLICY "Admins can insert badges"
ON public.badges
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update badges
CREATE POLICY "Admins can update badges"
ON public.badges
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete badges
CREATE POLICY "Admins can delete badges"
ON public.badges
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));