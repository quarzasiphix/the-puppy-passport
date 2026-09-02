-- Brand rename: Havenpaw -> Anemalo. Renaming an existing enum value is a metadata-only change
-- (no table rewrite); verified zero rows used 'full_havenpaw_service' before applying.
alter type public.market_state rename value 'full_havenpaw_service' to 'full_anemalo_service';
