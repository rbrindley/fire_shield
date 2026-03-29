#!/bin/bash
set -e

# Run any pending migrations
cd /app
python -c "
import sqlite3, os, glob
db_path = os.environ.get('DATABASE_URL', '/data/app.db').replace('sqlite:///', '')
os.makedirs(os.path.dirname(db_path), exist_ok=True)
conn = sqlite3.connect(db_path)
migrations = sorted(glob.glob('app/migrations/*.sql'))
for m in migrations:
    with open(m) as f:
        sql = f.read()
    try:
        conn.executescript(sql)
        conn.commit()
        print(f'Applied: {m}')
    except Exception as e:
        print(f'Skip (already applied or error): {m}: {e}')
conn.close()
print('Migrations done.')
"

# Start server
exec uvicorn app.config.main:app --host 0.0.0.0 --port "${PORT:-8000}"
