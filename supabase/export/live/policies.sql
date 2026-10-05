create policy Admin can manage profiles on public.profiles ; -- all to public using is_admin() with check is_admin()
create policy Admin can update orders on public.orders ; -- all to public using is_admin() with check null
create policy Admin can update signup requests on public.signup_requests ; -- all to public using is_admin() with check null
create policy Admin can view order items on public.order_items ; -- select to public using is_admin() with check null
create policy Admin can view orders on public.orders ; -- select to public using is_admin() with check null
create policy Admin can view signup requests on public.signup_requests ; -- select to public using is_admin() with check null
create policy Anon can create orders on public.orders ; -- insert to anon,authenticated using null with check true
create policy Anon can insert order items on public.order_items ; -- insert to anon,authenticated using null with check true
create policy Anon can submit signup requests on public.signup_requests ; -- insert to anon,authenticated using null with check (status = 'pending'::text)
create policy Anyone create order items on public.order_items ; -- insert to anon,authenticated using null with check true
create policy Anyone create orders on public.orders ; -- insert to anon,authenticated using null with check true
create policy Auth update profiles on public.profiles ; -- all to authenticated using true with check true
create policy Auth upsert profiles on public.profiles ; -- insert to authenticated using null with check true
create policy Auth write barber_status on public.barber_status ; -- all to authenticated using true with check true
create policy Authenticated can insert products on public.products ; -- insert to public using null with check (auth.role() = 'authenticated'::text)
create policy Authenticated read signup requests on public.signup_requests ; -- select to authenticated using true with check null
create policy Authenticated update signup requests on public.signup_requests ; -- all to authenticated using true with check true
create policy Owner or admin can delete products on public.products ; -- delete to public using (is_admin() OR (owner_id = auth.uid())) with check null
create policy Owner or admin can update products on public.products ; -- all to public using (is_admin() OR (owner_id = auth.uid())) with check null
create policy Public can create order items on public.order_items ; -- insert to public using null with check true
create policy Public can create orders on public.orders ; -- insert to public using null with check true
create policy Public can submit signup requests on public.signup_requests ; -- insert to public using null with check true
create policy Public can view approved products on public.products ; -- select to public using ((status = 'approved'::text) OR is_admin() OR (owner_id = auth.uid())) with check null
create policy Public read approved products on public.products ; -- select to public using ((status = 'approved'::text) OR (auth.role() = 'authenticated'::text)) with check null
create policy Public read barber_status on public.barber_status ; -- select to anon,authenticated using true with check null
create policy Users can read own profile on public.profiles ; -- select to authenticated using (id = auth.uid()) with check null
create policy Users can view own profile on public.profiles ; -- select to public using (auth.uid() = id) with check null
create policy Users read own profile on public.profiles ; -- select to authenticated using ((id = auth.uid()) OR true) with check null
create policy barber_profiles_delete_admin on public.barber_profiles ; -- delete to authenticated using is_admin() with check null
create policy barber_profiles_insert_owner on public.barber_profiles ; -- insert to authenticated using null with check ((user_id = auth.uid()) OR is_admin())
create policy barber_profiles_read on public.barber_profiles ; -- select to anon,authenticated using ((status = 'approved'::text) OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR is_admin()) with check null
create policy barber_profiles_update_owner on public.barber_profiles ; -- all to authenticated using ((user_id = auth.uid()) OR is_admin()) with check ((user_id = auth.uid()) OR is_admin())
create policy bookings_insert_public on public.barber_bookings ; -- insert to anon,authenticated using null with check true
create policy bookings_select_auth on public.barber_bookings ; -- select to authenticated using true with check null
create policy bookings_select_slots_anon on public.barber_bookings ; -- select to anon using true with check null
create policy bookings_update_auth on public.barber_bookings ; -- all to authenticated using true with check true
create policy carwash_profiles_delete_admin on public.carwash_profiles ; -- delete to authenticated using is_admin() with check null
create policy carwash_profiles_insert_owner on public.carwash_profiles ; -- insert to authenticated using null with check ((user_id = auth.uid()) OR is_admin())
create policy carwash_profiles_read on public.carwash_profiles ; -- select to anon,authenticated using ((status = 'approved'::text) OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR is_admin()) with check null
create policy carwash_profiles_update_owner on public.carwash_profiles ; -- all to authenticated using ((user_id = auth.uid()) OR is_admin()) with check ((user_id = auth.uid()) OR is_admin())
create policy handmade_profiles_delete_admin on public.handmade_profiles ; -- delete to authenticated using is_admin() with check null
create policy handmade_profiles_insert_owner on public.handmade_profiles ; -- insert to authenticated using null with check ((user_id = auth.uid()) OR is_admin())
create policy handmade_profiles_read on public.handmade_profiles ; -- select to anon,authenticated using ((status = 'approved'::text) OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR is_admin()) with check null
create policy handmade_profiles_update_owner on public.handmade_profiles ; -- all to authenticated using ((user_id = auth.uid()) OR is_admin()) with check ((user_id = auth.uid()) OR is_admin())
create policy merchant_profiles_delete_admin on public.merchant_profiles ; -- delete to authenticated using is_admin() with check null
create policy merchant_profiles_insert_owner on public.merchant_profiles ; -- insert to authenticated using null with check ((user_id = auth.uid()) OR is_admin())
create policy merchant_profiles_read on public.merchant_profiles ; -- select to anon,authenticated using ((status = 'approved'::text) OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR is_admin()) with check null
create policy merchant_profiles_update_owner on public.merchant_profiles ; -- all to authenticated using ((user_id = auth.uid()) OR is_admin()) with check ((user_id = auth.uid()) OR is_admin())
create policy order_items_delete_admin on public.order_items ; -- delete to authenticated using is_admin() with check null
create policy order_items_insert_any on public.order_items ; -- insert to anon,authenticated using null with check true
create policy order_items_select_own on public.order_items ; -- select to authenticated using (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.customer_user_id = auth.uid())))) with check null
create policy orders_delete_admin on public.orders ; -- delete to authenticated using is_admin() with check null
create policy orders_insert_any on public.orders ; -- insert to anon,authenticated using null with check true
create policy orders_select_own on public.orders ; -- select to authenticated using (customer_user_id = auth.uid()) with check null
create policy products_delete_owner_or_admin on public.products ; -- delete to authenticated using (is_admin() OR (owner_id = auth.uid())) with check null
create policy products_insert_authenticated on public.products ; -- insert to authenticated using null with check true
create policy profiles_insert_auth on public.profiles ; -- insert to authenticated using null with check true
create policy profiles_select_auth on public.profiles ; -- select to authenticated using true with check null
create policy profiles_update_auth on public.profiles ; -- all to authenticated using true with check true
create policy service_categories_read on public.service_categories ; -- select to anon,authenticated using true with check null
