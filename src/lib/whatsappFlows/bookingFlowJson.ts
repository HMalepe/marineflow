/**
 * WhatsApp Flows JSON definition — 5-screen booking experience.
 * Service → Staff → Date → Time → Confirm
 *
 * Data for each screen is fetched dynamically via the data exchange endpoint.
 * https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 */

export function buildBookingFlowJson(_salonName: string): object {
  return {
    version: '6.1',
    data_api_version: '3.0',
    routing_model: {
      SERVICE_SCREEN: ['STAFF_SCREEN'],
      STAFF_SCREEN: ['DATE_SCREEN'],
      DATE_SCREEN: ['TIME_SCREEN'],
      TIME_SCREEN: ['CONFIRM_SCREEN'],
      CONFIRM_SCREEN: [],
    },
    screens: [
      // ── Screen 1: Choose Service ─────────────────────────────────────────
      {
        id: 'SERVICE_SCREEN',
        title: 'Choose Service',
        terminal: false,
        data: {
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
              },
            },
            __example__: [{ id: 'svc1', title: 'Haircut', description: '30 min · R150' }],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'RadioButtonsGroup',
              name: 'serviceId',
              label: 'What service would you like?',
              required: true,
              'data-source': '${data.services}',
            },
            {
              type: 'Footer',
              label: 'Next →',
              'on-click-action': {
                name: 'data_exchange',
                payload: {
                  screen: 'STAFF_SCREEN',
                  serviceId: '${form.serviceId}',
                },
              },
            },
          ],
        },
      },

      // ── Screen 2: Choose Staff ───────────────────────────────────────────
      {
        id: 'STAFF_SCREEN',
        title: 'Choose Staff',
        terminal: false,
        data: {
          staff: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
              },
            },
            __example__: [{ id: 'staff1', title: 'Alice', description: 'Stylist' }],
          },
          serviceId: { type: 'string', __example__: 'svc1' },
          serviceName: { type: 'string', __example__: 'Haircut' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: '${data.serviceName}',
            },
            {
              type: 'RadioButtonsGroup',
              name: 'staffId',
              label: 'Who would you like?',
              required: true,
              'data-source': '${data.staff}',
            },
            {
              type: 'Footer',
              label: 'Choose Date →',
              'on-click-action': {
                name: 'data_exchange',
                payload: {
                  screen: 'DATE_SCREEN',
                  serviceId: '${data.serviceId}',
                  staffId: '${form.staffId}',
                },
              },
            },
          ],
        },
      },

      // ── Screen 3: Choose Date ────────────────────────────────────────────
      {
        id: 'DATE_SCREEN',
        title: 'Choose Date',
        terminal: false,
        data: {
          serviceId: { type: 'string', __example__: 'svc1' },
          serviceName: { type: 'string', __example__: 'Haircut' },
          staffId: { type: 'string', __example__: 'staff1' },
          staffName: { type: 'string', __example__: 'Alice' },
          subtitle: { type: 'string', __example__: 'Haircut with Alice' },
          minDate: { type: 'string', __example__: '2026-06-16' },
          maxDate: { type: 'string', __example__: '2026-08-15' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: '${data.subtitle}',
            },
            {
              type: 'DatePicker',
              name: 'date',
              label: 'Pick a date',
              required: true,
              'min-date': '${data.minDate}',
              'max-date': '${data.maxDate}',
            },
            {
              type: 'Footer',
              label: 'See Times →',
              'on-click-action': {
                name: 'data_exchange',
                payload: {
                  screen: 'TIME_SCREEN',
                  serviceId: '${data.serviceId}',
                  staffId: '${data.staffId}',
                  date: '${form.date}',
                },
              },
            },
          ],
        },
      },

      // ── Screen 4: Choose Time ────────────────────────────────────────────
      {
        id: 'TIME_SCREEN',
        title: 'Choose Time',
        terminal: false,
        data: {
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
            __example__: [{ id: '2026-06-16T09:00:00.000Z', title: '09:00' }],
          },
          serviceId: { type: 'string', __example__: 'svc1' },
          serviceName: { type: 'string', __example__: 'Haircut' },
          staffId: { type: 'string', __example__: 'staff1' },
          staffName: { type: 'string', __example__: 'Alice' },
          date: { type: 'string', __example__: '2026-06-16' },
          dateLabel: { type: 'string', __example__: 'Monday, 16 Jun 2026' },
          subtitle: { type: 'string', __example__: 'Haircut with Alice' },
          noSlots: { type: 'boolean', __example__: false },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: '${data.dateLabel}',
            },
            {
              type: 'TextSubheading',
              text: '${data.subtitle}',
            },
            {
              type: 'RadioButtonsGroup',
              name: 'slotStart',
              label: 'Available times',
              required: true,
              'data-source': '${data.slots}',
            },
            {
              type: 'Footer',
              label: 'Review Booking →',
              'on-click-action': {
                name: 'data_exchange',
                payload: {
                  screen: 'CONFIRM_SCREEN',
                  serviceId: '${data.serviceId}',
                  serviceName: '${data.serviceName}',
                  staffId: '${data.staffId}',
                  staffName: '${data.staffName}',
                  date: '${data.date}',
                  dateLabel: '${data.dateLabel}',
                  slotStart: '${form.slotStart}',
                  timeLabel: '${form.slotStart}',
                },
              },
            },
          ],
        },
      },

      // ── Screen 5: Confirm ────────────────────────────────────────────────
      {
        id: 'CONFIRM_SCREEN',
        title: 'Confirm Booking',
        terminal: true,
        data: {
          serviceId: { type: 'string', __example__: 'svc1' },
          serviceName: { type: 'string', __example__: 'Haircut' },
          staffId: { type: 'string', __example__: 'staff1' },
          staffName: { type: 'string', __example__: 'Alice' },
          date: { type: 'string', __example__: '2026-06-16' },
          dateLabel: { type: 'string', __example__: 'Monday, 16 Jun 2026' },
          slotStart: { type: 'string', __example__: '2026-06-16T09:00:00.000Z' },
          timeLabel: { type: 'string', __example__: '09:00' },
          summary: { type: 'string', __example__: '💇 Haircut\n👤 Alice\n📅 Monday, 16 Jun 2026\n🕐 09:00' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: 'Booking Summary',
            },
            {
              type: 'TextBody',
              text: '${data.summary}',
            },
            {
              type: 'Footer',
              label: `Confirm Booking ✅`,
              'on-click-action': {
                name: 'complete',
                payload: {
                  serviceId: '${data.serviceId}',
                  serviceName: '${data.serviceName}',
                  staffId: '${data.staffId}',
                  staffName: '${data.staffName}',
                  date: '${data.date}',
                  slotStart: '${data.slotStart}',
                  timeLabel: '${data.timeLabel}',
                },
              },
            },
          ],
        },
      },
    ],
  };
}

/** Send-message payload that triggers the flow (type: 'flow'). */
export function buildFlowTriggerMessage(params: {
  salonName: string;
  flowId: string;
  flowToken: string;
  welcomeBody: string;
}): object {
  return {
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: `Book at ${params.salonName}`,
      },
      body: {
        text: params.welcomeBody,
      },
      footer: {
        text: 'Tap the button to get started',
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: params.flowToken,
          flow_id: params.flowId,
          flow_cta: '📅 Book Appointment',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'SERVICE_SCREEN',
          },
        },
      },
    },
  };
}
