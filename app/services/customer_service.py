import secrets
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.repositories.customer import CustomerRepository


class CustomerService:
    def __init__(self, db: Session):
        self.db = db
        self.customer_repo = CustomerRepository(db)

    def _generate_token(self) -> str:
        return secrets.token_urlsafe(16)

    def create_customer(
        self,
        *,
        created_by_user_id: int,
        full_name: str,
        emails: Optional[str] = None,
        phone_number: Optional[str] = None,
        tag: Optional[str] = None,
        location: Optional[str] = None,
        is_active: bool = True,
    ) -> Customer:
        token = self._generate_token()
        return self.customer_repo.create_customer(
            created_by_user_id=created_by_user_id,
            full_name=full_name,
            emails=emails,
            phone_number=phone_number,
            tag=tag,
            location=location,
            public_token=token,
            is_active=is_active,
        )

    def get_customer(self, customer_id: int) -> Optional[Customer]:
        return self.customer_repo.get_by_id(customer_id)

    def get_by_token(self, token: str) -> Optional[Customer]:
        return self.customer_repo.get_by_token(token)

    def list_customers(self, *, created_by_user_id: int, limit: int = 50, offset: int = 0, search: Optional[str] = None) -> List[Customer]:
        return self.customer_repo.list_customers(created_by_user_id=created_by_user_id, limit=limit, offset=offset, search=search)


    def update_customer(self, customer: Customer, **kwargs) -> Customer:
        return self.customer_repo.update_customer(customer, **kwargs)

    def delete_customer(self, customer: Customer) -> Customer:
        return self.customer_repo.delete_customer(customer)