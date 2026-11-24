-- Postgres encode() has no 'base64url' format ("unrecognized encoding").
-- Build the URL-safe token from base64 instead. Existing rows keep their tokens.
alter table invites
  alter column token set default
    translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

alter table invoices
  alter column invoice_token set default
    translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
