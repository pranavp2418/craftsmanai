from fastapi import Depends
from app.core.dependencies import (
    get_db as get_sync_db,
    get_current_superuser as get_current_admin,
    get_current_user,
    get_current_active_user,
    get_current_verified_user,
)
from app.models.user import User

class AsyncSessionAdapter:
    """
    An adapter that wraps a synchronous SQLAlchemy Session to expose 
    awaitable async methods. This bridges the gap for endpoints written 
    with async/await syntax while preserving the underlying synchronous connection.
    """
    def __init__(self, db_session):
        self.db = db_session

    async def execute(self, statement, *args, **kwargs):
        return self.db.execute(statement, *args, **kwargs)

    async def scalar(self, statement, *args, **kwargs):
        return self.db.scalar(statement, *args, **kwargs)

    async def scalars(self, statement, *args, **kwargs):
        return self.db.scalars(statement, *args, **kwargs)

    async def commit(self):
        self.db.commit()

    async def rollback(self):
        self.db.rollback()

    async def refresh(self, instance, *args, **kwargs):
        self.db.refresh(instance, *args, **kwargs)

    def add(self, instance):
        self.db.add(instance)

    def delete(self, instance):
        self.db.delete(instance)

    def query(self, *args, **kwargs):
        return self.db.query(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self.db, name)


def get_db(db=Depends(get_sync_db)):
    yield AsyncSessionAdapter(db)
