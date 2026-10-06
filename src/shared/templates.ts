import type { JevRequest } from './contracts'
export const templates: { name: string; description: string; icon: string; request: JevRequest }[] =
  [
    {
      name: 'Message routing',
      description: 'One message. Three useful decisions.',
      icon: 'route',
      request: {
        model: 'jev-latest',
        state:
          'I was charged twice for my subscription yesterday. Please refund the duplicate payment today — I need that money for rent.',
        questions: {
          department: {
            type: 'choice',
            instructions: 'Which team should handle this message?',
            criteria: {
              billing: 'Payments, invoices, refunds',
              technical: 'Bugs and technical help',
              sales: 'New plans and pricing'
            }
          },
          urgency: {
            type: 'score',
            instructions: 'How urgently does this message need attention?',
            criteria: [
              'Can wait several days',
              'Needs attention this week',
              'Needs attention today'
            ]
          },
          refund: {
            type: 'noul',
            instructions: 'Does the sender request a refund?',
            criteria: {
              true: 'Explicit or clearly implied request for money back',
              false: 'No request for money back'
            }
          }
        }
      }
    },
    {
      name: 'Spam detection',
      description: 'Explore yes, no, and the uncertain middle.',
      icon: 'shield',
      request: {
        model: 'jev-latest',
        state:
          'Congratulations! You have won a luxury holiday. Send your bank details in the next hour to claim your prize.',
        questions: {
          spam: {
            type: 'noul',
            instructions: 'Is this message unsolicited spam or a scam?',
            criteria: {
              true: 'Unsolicited promotion, deceptive reward, or request for sensitive details',
              false: 'A legitimate personal or business conversation'
            }
          }
        }
      }
    },
    {
      name: 'Task urgency',
      description: 'Build a rubric that matches your priorities.',
      icon: 'clock',
      request: {
        model: 'jev-latest',
        state: {
          task: 'Renew my passport',
          departure: 'In six weeks',
          processingTime: 'Six to eight weeks',
          otherTasks: ['Organize photos', 'Buy groceries']
        },
        questions: {
          priority: {
            type: 'score',
            instructions:
              'How urgent is the passport renewal, based on deadlines and processing time?',
            criteria: [
              'No near-term deadline',
              'Schedule soon',
              'Act today to avoid a missed deadline'
            ]
          }
        }
      }
    },
    {
      name: 'Document relevance',
      description: 'Score evidence against a search question.',
      icon: 'search',
      request: {
        model: 'jev-latest',
        state: {
          query: 'How do I reset my account password?',
          document:
            'Open Settings, choose Security, and select Reset password. A confirmation link will be sent to your verified email address.'
        },
        questions: {
          relevance: {
            type: 'score',
            instructions: 'How well does the document answer the query?',
            criteria: [
              'Unrelated',
              'Related topic, no useful answer',
              'Partly answers the question',
              'Directly answers the question'
            ]
          }
        }
      }
    }
  ]
