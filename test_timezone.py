"""Test script to verify timezone configuration"""
from app.core.config import settings
from sqlalchemy import create_engine, text
from datetime import datetime
from app.core.timezone import CST_TZ

# Connect to database
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql+asyncpg://"):
    database_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

engine = create_engine(database_url)

print("=" * 60)
print("TIMEZONE CONFIGURATION TEST")
print("=" * 60)

with engine.connect() as conn:
    # Check current database timezone
    result = conn.execute(text("SHOW timezone"))
    db_tz = result.scalar()
    print(f"\n1. Database timezone setting: {db_tz}")
    
    # Check users table column defaults
    result = conn.execute(text("""
        SELECT column_name, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('created_at', 'updated_at')
    """))
    print("\n2. Users table column defaults:")
    for row in result:
        print(f"   {row[0]}: {row[1]}")
    
    # Insert a test record to see what timezone it uses
    print("\n3. Testing new record creation...")
    
    # Get current time in CST
    now_cst = datetime.now(CST_TZ)
    print(f"   Current CST time (Python): {now_cst}")
    
    # Insert test user
    test_email = f"test_timezone_{datetime.now().timestamp()}@example.com"
    conn.execute(text("""
        INSERT INTO users (email, username, full_name, hashed_password, subscription_plan, created_at, updated_at)
        VALUES (:email, :username, :full_name, :password, :plan, :created_at, :updated_at)
        RETURNING id, created_at, updated_at
    """), {
        'email': test_email,
        'username': f'test_user_{datetime.now().timestamp()}',
        'full_name': 'Test User',
        'password': 'test_hash',
        'plan': 'Starter',
        'created_at': now_cst,
        'updated_at': now_cst
    })
    
    # Fetch the inserted record
    result = conn.execute(text(f"""
        SELECT id, created_at, updated_at 
        FROM users 
        WHERE email = '{test_email}'
    """))
    row = result.fetchone()
    if row:
        print(f"   Inserted record:")
        print(f"   ID: {row[0]}")
        print(f"   created_at: {row[1]}")
        print(f"   updated_at: {row[2]}")
        print(f"   Timezone offset: {row[1].utcoffset()}")
    
    conn.commit()
    
    # Clean up test record
    conn.execute(text(f"DELETE FROM users WHERE email = '{test_email}'"))
    conn.commit()

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)