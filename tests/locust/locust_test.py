from locust import HttpUser, task, between
from faker import Faker
from ulid import ULID
from datetime import datetime, timezone
import uuid


class SendMessageUser(HttpUser):
    wait_time = between(1, 3)  # Wait between 1 and 3 seconds between requests

    @task
    def send_message(self):
        fake = Faker()
        message_id = str(ULID())
        user_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).strftime(
            '%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        user_name = fake.name()
        user_message = fake.sentence()
        payload = {
            "action": "broadcastmessage",
            "message": {
                "messageId": message_id,
                "userId": user_id,
                "userName": user_name,
                "userMessage": user_message,
                "timestamp": timestamp,
            },
        }
        self.client.post("/messages", json=payload)
