-- Vendors edit their own listing (C6c, #194): a vendor's people read and
-- change the parts of the listing families see that are theirs to keep up to
-- date. The name, address, vendor types and whether it's published stay with
-- the founders. Every value goes through the vendors table's own checks.
--
-- my_listing(vendor)                  The editable fields, drafts included.
-- update_my_listing(vendor, changes)  Save some of them; a key set to null
--                                     clears that field.

create function private.my_listing(p_vendor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vendors;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v from public.vendors where id = p_vendor_id;
  return jsonb_build_object(
    'name', v.name,
    'slug', v.slug,
    'status', v.status,
    'city', v.city,
    'tagline', v.tagline,
    'taglinePa', v.tagline_pa,
    'bio', v.bio,
    'bioPa', v.bio_pa,
    'priceDisplay', v.price_display,
    'priceFrom', v.price_from,
    'priceTo', v.price_to,
    'priceUnit', v.price_unit,
    'priceNote', v.price_note,
    'callPhone', v.call_phone,
    'textPhone', v.text_phone,
    'whatsappPhone', v.whatsapp_phone,
    'preferredContact', v.preferred_contact,
    'instagramHandle', v.instagram_handle,
    'websiteUrl', v.website_url,
    'languages', to_jsonb(v.languages),
    'yearsInBusiness', v.years_in_business,
    'teamSize', v.team_size,
    'serviceRadiusMiles', v.service_radius_miles,
    'willTravel', v.will_travel,
    'travelNote', v.travel_note,
    'officeHours', v.office_hours
  );
end;
$$;

create function public.my_listing(p_vendor_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.my_listing(p_vendor_id);
$$;

comment on function public.my_listing is
  'The listing fields a vendor''s people can edit, drafts included. Only the vendor''s members.';

-- Text from the app: trimmed, and empty means cleared
create function private.clean_text(p_value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p_value #>> '{}'), '');
$$;

create function private.update_my_listing(p_vendor_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  editable text[] := array[
    'tagline', 'taglinePa', 'bio', 'bioPa', 'priceDisplay', 'priceFrom', 'priceTo',
    'priceUnit', 'priceNote', 'callPhone', 'textPhone', 'whatsappPhone', 'preferredContact',
    'instagramHandle', 'websiteUrl', 'languages', 'yearsInBusiness', 'teamSize',
    'serviceRadiusMiles', 'willTravel', 'travelNote', 'officeHours'
  ];
  unknown text;
  c jsonb := p_changes;
  website text;
  failed_constraint text;
begin
  if not private.is_vendor_member(p_vendor_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if c is null or jsonb_typeof(c) <> 'object' then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  select k into unknown from jsonb_object_keys(c) as k where k <> all (editable) limit 1;
  if unknown is not null then
    raise exception 'not_editable:%', unknown using errcode = '42501';
  end if;
  if c ? 'languages' and jsonb_typeof(c -> 'languages') not in ('array', 'null') then
    raise exception 'invalid_field:languages' using errcode = '22023';
  end if;

  -- Families type websites without https://
  website := private.clean_text(c -> 'websiteUrl');
  if website is not null and website !~* '^https?://' then
    website := 'https://' || website;
  end if;

  begin
    update public.vendors v set
      tagline = case when c ? 'tagline' then private.clean_text(c -> 'tagline') else v.tagline end,
      tagline_pa = case when c ? 'taglinePa' then private.clean_text(c -> 'taglinePa') else v.tagline_pa end,
      bio = case when c ? 'bio' then private.clean_text(c -> 'bio') else v.bio end,
      bio_pa = case when c ? 'bioPa' then private.clean_text(c -> 'bioPa') else v.bio_pa end,
      price_display = case when c ? 'priceDisplay'
        then coalesce(private.clean_text(c -> 'priceDisplay'), 'contact') else v.price_display end,
      price_from = case when c ? 'priceFrom' then (private.clean_text(c -> 'priceFrom'))::integer else v.price_from end,
      price_to = case when c ? 'priceTo' then (private.clean_text(c -> 'priceTo'))::integer else v.price_to end,
      price_unit = case when c ? 'priceUnit' then private.clean_text(c -> 'priceUnit') else v.price_unit end,
      price_note = case when c ? 'priceNote' then private.clean_text(c -> 'priceNote') else v.price_note end,
      call_phone = case when c ? 'callPhone' then private.clean_text(c -> 'callPhone') else v.call_phone end,
      text_phone = case when c ? 'textPhone' then private.clean_text(c -> 'textPhone') else v.text_phone end,
      whatsapp_phone = case when c ? 'whatsappPhone' then private.clean_text(c -> 'whatsappPhone') else v.whatsapp_phone end,
      preferred_contact = case when c ? 'preferredContact'
        then private.clean_text(c -> 'preferredContact') else v.preferred_contact end,
      instagram_handle = case when c ? 'instagramHandle'
        then ltrim(private.clean_text(c -> 'instagramHandle'), '@') else v.instagram_handle end,
      website_url = case when c ? 'websiteUrl' then website else v.website_url end,
      languages = case when c ? 'languages'
        then array(select jsonb_array_elements_text(coalesce(c -> 'languages', '[]'::jsonb)))
        else v.languages end,
      years_in_business = case when c ? 'yearsInBusiness'
        then (private.clean_text(c -> 'yearsInBusiness'))::integer else v.years_in_business end,
      team_size = case when c ? 'teamSize' then (private.clean_text(c -> 'teamSize'))::integer else v.team_size end,
      service_radius_miles = case when c ? 'serviceRadiusMiles'
        then (private.clean_text(c -> 'serviceRadiusMiles'))::integer else v.service_radius_miles end,
      will_travel = case when c ? 'willTravel'
        then coalesce((private.clean_text(c -> 'willTravel'))::boolean, false) else v.will_travel end,
      travel_note = case when c ? 'travelNote' then private.clean_text(c -> 'travelNote') else v.travel_note end,
      office_hours = case when c ? 'officeHours' then private.clean_text(c -> 'officeHours') else v.office_hours end,
      updated_at = now()
    where v.id = p_vendor_id;
  exception
    when check_violation or not_null_violation then
      get stacked diagnostics failed_constraint = constraint_name;
      raise exception 'invalid_field:%', coalesce(
        case failed_constraint
          when 'vendors_tagline_check' then 'tagline'
          when 'vendors_tagline_pa_check' then 'taglinePa'
          when 'vendors_bio_check' then 'bio'
          when 'vendors_bio_pa_check' then 'bioPa'
          when 'vendors_price_display_check' then 'priceDisplay'
          when 'vendors_price_from_check' then 'priceFrom'
          when 'vendors_price_to_check' then 'priceTo'
          when 'vendors_price_unit_check' then 'priceUnit'
          when 'vendors_price_matches_display' then 'priceDisplay'
          when 'vendors_price_note_check' then 'priceNote'
          when 'vendors_call_phone_check' then 'callPhone'
          when 'vendors_text_phone_check' then 'textPhone'
          when 'vendors_whatsapp_phone_check' then 'whatsappPhone'
          when 'vendors_preferred_contact_check' then 'preferredContact'
          when 'vendors_instagram_handle_check' then 'instagramHandle'
          when 'vendors_website_url_check' then 'websiteUrl'
          when 'vendors_languages_check' then 'languages'
          when 'vendors_years_in_business_check' then 'yearsInBusiness'
          when 'vendors_team_size_check' then 'teamSize'
          when 'vendors_service_radius_miles_check' then 'serviceRadiusMiles'
          when 'vendors_travel_note_check' then 'travelNote'
          when 'vendors_office_hours_check' then 'officeHours'
        end,
        'unknown') using errcode = '22023';
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_field:number' using errcode = '22023';
  end;

  return private.my_listing(p_vendor_id);
end;
$$;

create function public.update_my_listing(p_vendor_id uuid, p_changes jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_my_listing(p_vendor_id, p_changes);
$$;

comment on function public.update_my_listing is
  'Save changes to the editable listing fields ({tagline: "…", priceFrom: 45, …}; null clears one) and return the listing. Only the vendor''s members. Errors: not_allowed, invalid_changes, not_editable:<key>, invalid_field:<key>.';

revoke all on function
  private.my_listing, public.my_listing, private.update_my_listing, public.update_my_listing,
  private.clean_text
from public;
grant execute on function
  private.my_listing, public.my_listing, private.update_my_listing, public.update_my_listing
to authenticated;
