import json
import asyncio
from aiokafka import AIOKafkaProducer
from app.config.settings import settings

class KafkaBroker:
    def __init__(self):
        self.producer = None

    async def connect(self):
        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        await self.producer.start()
        print("Connected to Kafka/Redpanda.")

    async def close(self):
        if self.producer:
            await self.producer.stop()

    async def publish_event(self, topic: str, event_data: dict):
        if not self.producer:
            await self.connect()
        await self.producer.send_and_wait(topic, value=event_data)

broker = KafkaBroker()
