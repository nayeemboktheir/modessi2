-- Add RLS policy to allow public to read cotton_tarsel_video_url setting
CREATE POLICY "Public can read cotton tarsel video setting" 
ON public.admin_settings 
FOR SELECT 
USING (key = 'cotton_tarsel_video_url');