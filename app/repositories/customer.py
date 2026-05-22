from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.customer import Customer


class CustomerRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_customer(
        self,
        *,
        created_by_user_id: int,
        full_name: str,
        public_token: str,
        emails: Optional[str] = None,
        phone_number: Optional[str] = None,
        tag: Optional[str] = None,
        location: Optional[str] = None,
        is_active: bool = True,
    ) -> Customer:
        customer = Customer(
            created_by_user_id=created_by_user_id,
            full_name=full_name,
            emails=emails,
            phone_number=phone_number,
            tag=tag,
            location=location,
            public_token=public_token,
            is_active=is_active,
        )
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def get_by_id(self, customer_id: int) -> Optional[Customer]:
        return self.db.query(Customer).filter(Customer.id == customer_id, Customer.is_deleted == False).first()

    def get_by_token(self, token: str) -> Optional[Customer]:
        return self.db.query(Customer).filter(Customer.public_token == token, Customer.is_deleted == False).first()

    def list_customers(self, *, created_by_user_id: int, limit: int = 50, offset: int = 0, search: Optional[str] = None) -> List[Customer]:
        query = self.db.query(Customer).filter(Customer.created_by_user_id == created_by_user_id, Customer.is_deleted == False)
        if search:
            query = query.filter(
                (Customer.full_name.ilike(f"%{search}%")) | (Customer.emails.ilike(f"%{search}%"))
            )
        return (
            query.order_by(Customer.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def update_customer(self, customer: Customer, **kwargs) -> Customer:
        for field, value in kwargs.items():
            if hasattr(customer, field) and value is not None:
                setattr(customer, field, value)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def count_customers(self, *, created_by_user_id: int, search: Optional[str] = None) -> int:
        query = self.db.query(func.count(Customer.id)).filter(Customer.created_by_user_id == created_by_user_id, Customer.is_deleted == False)
        if search:
            query = query.filter(
                (Customer.full_name.ilike(f"%{search}%")) | (Customer.emails.ilike(f"%{search}%"))
            )
        return (
            query.scalar()
            or 0
        )


    def delete_customer(self, customer: Customer) -> Customer:
        customer.is_deleted = True
        self.db.commit()
        self.db.refresh(customer)
        return customer