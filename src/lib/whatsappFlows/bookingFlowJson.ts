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
      STAFF_SCREEN: ['DATE_SCREEN', 'SERVICE_SCREEN'],
      DATE_SCREEN: ['TIME_SCREEN', 'STAFF_SCREEN'],
      TIME_SCREEN: ['CONFIRM_SCREEN', 'DATE_SCREEN'],
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
          },
          serviceId: { type: 'string' },
          serviceName: { type: 'string' },
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
          serviceId: { type: 'string' },
          serviceName: { type: 'string' },
          staffId: { type: 'string' },
          staffName: { type: 'string' },
          minDate: { type: 'string' },
          maxDate: { type: 'string' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: '${data.serviceName} with ${data.staffName}',
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
          },
          serviceId: { type: 'string' },
          serviceName: { type: 'string' },
          staffId: { type: 'string' },
          staffName: { type: 'string' },
          date: { type: 'string' },
          dateLabel: { type: 'string' },
          noSlots: { type: 'boolean' },
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
              text: '${data.serviceName} with ${data.staffName}',
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
          serviceId: { type: 'string' },
          serviceName: { type: 'string' },
          staffId: { type: 'string' },
          staffName: { type: 'string' },
          date: { type: 'string' },
          dateLabel: { type: 'string' },
          slotStart: { type: 'string' },
          timeLabel: { type: 'string' },
          summary: { type: 'string' },
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
