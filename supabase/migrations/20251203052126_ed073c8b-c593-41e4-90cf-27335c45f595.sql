-- Allow admins to delete any challenge attempt
CREATE POLICY "Admins can delete any challenge attempt"
ON public.challenge_attempts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));