# Event Processor Worker

The runnable MVP invokes `app.services.event_processor` in-process. This worker
folder is the extraction target for the Redpanda/FastStream deployment.

Future command:

```bash
python -m workers.event_processor.main
```

Consumer topics:

- `raw.events`
- `validated.events`
- `enriched.events`

Producer topics:

- `incident.events`
- `alert.events`
- `agent.tasks`
- `dead_letter.events`
