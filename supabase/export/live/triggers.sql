CREATE TRIGGER trg_guard_barber_profiles BEFORE INSERT OR UPDATE ON public.barber_profiles FOR EACH ROW EXECUTE FUNCTION guard_provider_row();
CREATE TRIGGER trg_guard_carwash_profiles BEFORE INSERT OR UPDATE ON public.carwash_profiles FOR EACH ROW EXECUTE FUNCTION guard_provider_row();
CREATE TRIGGER trg_guard_handmade_profiles BEFORE INSERT OR UPDATE ON public.handmade_profiles FOR EACH ROW EXECUTE FUNCTION guard_provider_row();
CREATE TRIGGER trg_guard_merchant_profiles BEFORE INSERT OR UPDATE ON public.merchant_profiles FOR EACH ROW EXECUTE FUNCTION guard_provider_row();
CREATE TRIGGER tr_deduct_stock AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION deduct_product_stock();
CREATE TRIGGER trg_enforce_seller_product_insert BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION enforce_seller_product_insert();
CREATE TRIGGER trg_enforce_seller_product_update BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION enforce_seller_product_update();
CREATE TRIGGER trg_products_owner_pending BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION set_product_owner_and_pending();
CREATE TRIGGER trg_guard_profile_role BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_role()
