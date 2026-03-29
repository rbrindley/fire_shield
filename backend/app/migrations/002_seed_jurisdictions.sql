-- Fire Shield - Jurisdiction Seed Data
-- Rogue Valley, Oregon jurisdiction hierarchy

-- Insert order matters (parents before children)

INSERT OR IGNORE INTO jurisdictions (code, display_name, parent_code, jurisdiction_chain) VALUES
('universal',        'Universal (All)',                      NULL,             '["universal"]'),
('federal',          'Federal',                              NULL,             '["federal","universal"]'),
('oregon_state',     'Oregon State',                         NULL,             '["oregon_state","federal","universal"]'),
('jackson_county',   'Jackson County, Oregon',               'oregon_state',   '["jackson_county","oregon_state","federal","universal"]'),
('josephine_county', 'Josephine County, Oregon',             'oregon_state',   '["josephine_county","oregon_state","federal","universal"]'),
('ashland',          'City of Ashland, Oregon',              'jackson_county', '["ashland","jackson_county","oregon_state","federal","universal"]'),
('jacksonville',     'City of Jacksonville, Oregon',         'jackson_county', '["jacksonville","jackson_county","oregon_state","federal","universal"]'),
('medford',          'City of Medford, Oregon',              'jackson_county', '["medford","jackson_county","oregon_state","federal","universal"]'),
('talent',           'City of Talent, Oregon',               'jackson_county', '["talent","jackson_county","oregon_state","federal","universal"]'),
('phoenix',          'City of Phoenix, Oregon',              'jackson_county', '["phoenix","jackson_county","oregon_state","federal","universal"]'),
('central_point',    'City of Central Point, Oregon',        'jackson_county', '["central_point","jackson_county","oregon_state","federal","universal"]'),
('eagle_point',      'City of Eagle Point, Oregon',          'jackson_county', '["eagle_point","jackson_county","oregon_state","federal","universal"]'),
('grants_pass',      'City of Grants Pass, Oregon',          'josephine_county','["grants_pass","josephine_county","oregon_state","federal","universal"]');
