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
        name: str,
        public_token: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        company_name: Optional[str] = None,
        address: Optional[str] = None,
        is_active: bool = True,
    ) -> Customer:
        customer = Customer(
            created_by_user_id=created_by_user_id,
            name=name,
            email=email,
            phone=phone,
            company_name=company_name,
            address=address,
            public_token=public_token,
            is_active=is_active,
        )
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def get_by_id(self, customer_id: int) -> Optional[Customer]:
        return self.db.query(Customer).filter(Customer.id == customer_id).first()

    def get_by_token(self, token: str) -> Optional[Customer]:
        return self.db.query(Customer).filter(Customer.public_token == token).first()

    def list_customers(self, *, created_by_user_id: int, limit: int = 50, offset: int = 0) -> List[Customer]:
        return (
            self.db.query(Customer)
            .filter(Customer.created_by_user_id == created_by_user_id)
            .order_by(Customer.created_at.desc())
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

    def count_customers(self, *, created_by_user_id: int) -> int:
        return (
            self.db.query(func.count(Customer.id))
            .filter(Customer.created_by_user_id == created_by_user_id)
            .scalar()
            or 0
        )