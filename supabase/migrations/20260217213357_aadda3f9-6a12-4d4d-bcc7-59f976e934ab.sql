-- Allow public to read reyon cotton video URL setting
CREATE POLICY "Public can read reyon cotton video setting"
ON public.admin_settings
FOR SELECT
USING (key = 'reyon_cotton_video_url');