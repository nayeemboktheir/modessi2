CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'full_name', 
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: update_product_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.products
  SET 
    rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
    review_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id))
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    street text NOT NULL,
    city text NOT NULL,
    district text NOT NULL,
    postal_code text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    image_url text NOT NULL,
    link_url text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    variation_id uuid
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image_url text,
    description text,
    parent_id uuid,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    discount_type character varying(20) DEFAULT 'percentage'::character varying NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    min_order_amount numeric(10,2) DEFAULT 0,
    max_discount_amount numeric(10,2) DEFAULT NULL::numeric,
    usage_limit integer,
    used_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    starts_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('fixed'::character varying)::text])))
);


--
-- Name: draft_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.draft_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id text NOT NULL,
    shipping_name text,
    shipping_phone text,
    shipping_street text,
    shipping_district text,
    shipping_city text,
    shipping_postal_code text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric DEFAULT 0,
    shipping_cost numeric DEFAULT 0,
    total numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    converted_at timestamp with time zone,
    is_converted boolean DEFAULT false
);


--
-- Name: home_page_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_page_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: landing_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    is_active boolean DEFAULT false,
    is_published boolean DEFAULT false,
    hero_title text,
    hero_subtitle text,
    hero_image text,
    hero_button_text text,
    hero_button_link text,
    hero_button_style text DEFAULT 'primary'::text,
    features_enabled boolean DEFAULT false,
    features_title text,
    features jsonb DEFAULT '[]'::jsonb,
    products_enabled boolean DEFAULT false,
    products_title text,
    product_ids uuid[] DEFAULT '{}'::uuid[],
    cta_enabled boolean DEFAULT false,
    cta_title text,
    cta_subtitle text,
    cta_button_text text,
    cta_button_link text,
    cta_background_color text,
    testimonials_enabled boolean DEFAULT false,
    testimonials_title text,
    testimonials jsonb DEFAULT '[]'::jsonb,
    faq_enabled boolean DEFAULT false,
    faq_title text,
    faqs jsonb DEFAULT '[]'::jsonb,
    custom_css text,
    meta_title text,
    meta_description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb,
    theme_settings jsonb DEFAULT '{"textColor": "#1f2937", "fontFamily": "Inter", "accentColor": "#ef4444", "buttonStyle": "filled", "borderRadius": "8px", "primaryColor": "#000000", "secondaryColor": "#f5f5f5", "backgroundColor": "#ffffff"}'::jsonb,
    checkout_enabled boolean DEFAULT true,
    checkout_title text DEFAULT 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন'::text,
    checkout_button_text text DEFAULT 'অর্ডার কনফার্ম করুন'::text
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    product_image text,
    price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    variation_id uuid,
    variation_name text
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    order_number text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_method text DEFAULT 'cod'::text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    shipping_name text NOT NULL,
    shipping_phone text NOT NULL,
    shipping_street text NOT NULL,
    shipping_city text NOT NULL,
    shipping_district text NOT NULL,
    shipping_postal_code text,
    tracking_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    order_source text DEFAULT 'web'::text NOT NULL,
    is_printed boolean DEFAULT false NOT NULL,
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cod'::text, 'stripe'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'confirmed'::text, 'shipped'::text, 'delivered'::text, 'returned'::text, 'cancelled'::text])))
);


--
-- Name: product_variations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    price numeric NOT NULL,
    original_price numeric,
    stock integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    original_price numeric(10,2),
    category_id uuid,
    stock integer DEFAULT 0 NOT NULL,
    rating numeric(2,1) DEFAULT 0,
    review_count integer DEFAULT 0,
    images text[] DEFAULT '{}'::text[],
    tags text[] DEFAULT '{}'::text[],
    is_featured boolean DEFAULT false,
    is_new boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    short_description text,
    long_description text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text,
    email text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    images text[] DEFAULT '{}'::text[],
    helpful_count integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: sms_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    message text NOT NULL,
    template_key text,
    order_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    provider_response jsonb,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    template_name text NOT NULL,
    message_template text NOT NULL,
    is_active boolean DEFAULT true,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL
);


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_key_key UNIQUE (key);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: draft_orders draft_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_orders
    ADD CONSTRAINT draft_orders_pkey PRIMARY KEY (id);


--
-- Name: home_page_content home_page_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_page_content
    ADD CONSTRAINT home_page_content_pkey PRIMARY KEY (id);


--
-- Name: home_page_content home_page_content_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_page_content
    ADD CONSTRAINT home_page_content_section_key_key UNIQUE (section_key);


--
-- Name: landing_pages landing_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_pkey PRIMARY KEY (id);


--
-- Name: landing_pages landing_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_pages
    ADD CONSTRAINT landing_pages_slug_key UNIQUE (slug);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_variations product_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: sms_logs sms_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_pkey PRIMARY KEY (id);


--
-- Name: sms_templates sms_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (id);


--
-- Name: sms_templates sms_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_template_key_key UNIQUE (template_key);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: admin_settings_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_settings_key_unique ON public.admin_settings USING btree (key);


--
-- Name: idx_cart_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_user ON public.cart_items USING btree (user_id);


--
-- Name: idx_contact_submissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions USING btree (created_at DESC);


--
-- Name: idx_contact_submissions_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_is_read ON public.contact_submissions USING btree (is_read);


--
-- Name: idx_draft_orders_converted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_orders_converted ON public.draft_orders USING btree (is_converted);


--
-- Name: idx_draft_orders_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draft_orders_session ON public.draft_orders USING btree (session_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);


--
-- Name: idx_product_variations_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variations_product_id ON public.product_variations USING btree (product_id);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_featured ON public.products USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_wishlist_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_user ON public.wishlist_items USING btree (user_id);


--
-- Name: orders generate_order_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: reviews on_review_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_review_change AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();


--
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: admin_settings update_admin_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: draft_orders update_draft_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_draft_orders_updated_at BEFORE UPDATE ON public.draft_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: home_page_content update_home_page_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_home_page_content_updated_at BEFORE UPDATE ON public.home_page_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: landing_pages update_landing_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_landing_pages_updated_at BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: product_variations update_product_variations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_variations_updated_at BEFORE UPDATE ON public.product_variations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: sms_templates update_sms_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.product_variations(id);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id);


--
-- Name: draft_orders draft_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draft_orders
    ADD CONSTRAINT draft_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_variation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variation_id_fkey FOREIGN KEY (variation_id) REFERENCES public.product_variations(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: product_variations product_variations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variations
    ADD CONSTRAINT product_variations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sms_logs sms_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_page_content Admins can delete home page content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete home page content" ON public.home_page_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: home_page_content Admins can insert home page content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert home page content" ON public.home_page_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sms_templates Admins can manage SMS templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage SMS templates" ON public.sms_templates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: draft_orders Admins can manage all draft orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all draft orders" ON public.draft_orders USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can manage all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all order items" ON public.order_items USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can manage all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all orders" ON public.orders USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reviews Admins can manage all reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all reviews" ON public.reviews USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: banners Admins can manage banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage banners" ON public.banners USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage categories" ON public.categories USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contact_submissions Admins can manage contact submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage contact submissions" ON public.contact_submissions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: coupons Admins can manage coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage coupons" ON public.coupons USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: landing_pages Admins can manage landing pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage landing pages" ON public.landing_pages USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variations Admins can manage product variations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage product variations" ON public.product_variations USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage products" ON public.products USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_settings Admins can manage settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings" ON public.admin_settings USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: home_page_content Admins can update home page content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update home page content" ON public.home_page_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sms_logs Admins can view all SMS logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all SMS logs" ON public.sms_logs TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variations Admins can view all product variations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all product variations" ON public.product_variations FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can view all products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all products" ON public.products FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contact_submissions Anyone can create contact submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create contact submissions" ON public.contact_submissions FOR INSERT WITH CHECK (true);


--
-- Name: draft_orders Anyone can create draft orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create draft orders" ON public.draft_orders FOR INSERT WITH CHECK (true);


--
-- Name: order_items Anyone can create order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);


--
-- Name: orders Anyone can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);


--
-- Name: home_page_content Anyone can read home page content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read home page content" ON public.home_page_content FOR SELECT USING (true);


--
-- Name: draft_orders Anyone can update their draft orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update their draft orders" ON public.draft_orders FOR UPDATE USING (true);


--
-- Name: banners Anyone can view active banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING ((is_active = true));


--
-- Name: coupons Anyone can view active coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active coupons" ON public.coupons FOR SELECT USING ((is_active = true));


--
-- Name: product_variations Anyone can view active product variations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active product variations" ON public.product_variations FOR SELECT USING ((is_active = true));


--
-- Name: products Anyone can view active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING ((is_active = true));


--
-- Name: categories Anyone can view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);


--
-- Name: landing_pages Anyone can view published landing pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published landing pages" ON public.landing_pages FOR SELECT USING (((is_published = true) AND (is_active = true)));


--
-- Name: reviews Anyone can view reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);


--
-- Name: admin_settings Public can read FB Pixel settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read FB Pixel settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['fb_pixel_id'::text, 'fb_pixel_enabled'::text])));


--
-- Name: admin_settings Public can read header settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read header settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['site_name'::text, 'site_logo'::text, 'header_phone'::text, 'header_promo_text'::text])));


--
-- Name: admin_settings Public can read shop settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read shop settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['shop_name'::text, 'shop_logo_url'::text, 'favicon_url'::text, 'landing_product_video'::text, 'landing_review_video'::text, 'landing_review_videos'::text, 'landing_product_price'::text, 'landing_product_original_price'::text, 'landing_product_name'::text, 'phone_number'::text])));


--
-- Name: admin_settings Public can read social media settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read social media settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['messenger_enabled'::text, 'messenger_page_id'::text, 'whatsapp_enabled'::text, 'whatsapp_number'::text, 'call_enabled'::text, 'call_number'::text])));


--
-- Name: reviews Users can create their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own reviews" ON public.reviews FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: reviews Users can delete their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own reviews" ON public.reviews FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: addresses Users can manage their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own addresses" ON public.addresses USING ((auth.uid() = user_id));


--
-- Name: cart_items Users can manage their own cart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own cart" ON public.cart_items USING ((auth.uid() = user_id));


--
-- Name: wishlist_items Users can manage their own wishlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own wishlist" ON public.wishlist_items USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: reviews Users can update their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: order_items Users can view their own order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.draft_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: home_page_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_page_content ENABLE ROW LEVEL SECURITY;

--
-- Name: landing_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;