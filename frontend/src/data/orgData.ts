export interface OrgNode {
  id: string
  name: string
  title: string
  dept: string
  email: string
  reportsTo: string | null
  teamSize: number
  children: OrgNode[]
}

export const orgData: OrgNode = {
  id: 'ceo',
  name: 'Trevor Dixon and Shubham Singh',
  title: 'Co-CEOs & Co-Founders',
  dept: 'Executive',
  email: 'co-founders@grokclock.com',
  reportsTo: null,
  teamSize: 5,
  children: [
    {
      id: 'eng',
      name: 'Jordan Lee',
      title: 'CTO',
      dept: 'Engineering',
      email: 'jordan@grokclock.com',
      reportsTo: 'Alex Rivera',
      teamSize: 3,
      children: [
        { id: 'fe', name: 'Sam Chen', title: 'Frontend Lead', dept: 'Engineering', email: 'sam@grokclock.com', reportsTo: 'Jordan Lee', teamSize: 3, children: [
          { id: 'fe1', name: 'Parker Kim', title: 'Senior Frontend Engineer', dept: 'Engineering', email: 'parker@grokclock.com', reportsTo: 'Sam Chen', teamSize: 0, children: [] },
          { id: 'fe2', name: 'Quinn Torres', title: 'Frontend Engineer', dept: 'Engineering', email: 'quinn@grokclock.com', reportsTo: 'Sam Chen', teamSize: 0, children: [] },
        ] },
        { id: 'be', name: 'Taylor Kim', title: 'Backend Lead', dept: 'Engineering', email: 'taylor@grokclock.com', reportsTo: 'Jordan Lee', teamSize: 4, children: [
          { id: 'be1', name: 'Cameron Ellis', title: 'Senior Backend Engineer', dept: 'Engineering', email: 'cameron@grokclock.com', reportsTo: 'Taylor Kim', teamSize: 0, children: [] },
          { id: 'be2', name: 'Jordan Vale', title: 'Backend Engineer', dept: 'Engineering', email: 'jordanv@grokclock.com', reportsTo: 'Taylor Kim', teamSize: 0, children: [] },
          { id: 'be3', name: 'Morgan Ellis', title: 'Backend Engineer', dept: 'Engineering', email: 'morgan@grokclock.com', reportsTo: 'Taylor Kim', teamSize: 0, children: [] },
        ] },
        { id: 'infra', name: 'Casey Brooks', title: 'Infra Lead', dept: 'Engineering', email: 'casey@grokclock.com', reportsTo: 'Jordan Lee', teamSize: 2, children: [
          { id: 'inf1', name: 'Riley Voss', title: 'DevOps Engineer', dept: 'Engineering', email: 'rileyv@grokclock.com', reportsTo: 'Casey Brooks', teamSize: 0, children: [] },
        ] },
      ],
    },
    {
      id: 'sales',
      name: 'Casey Morgan',
      title: 'VP Sales',
      dept: 'Sales',
      email: 'casey@grokclock.com',
      reportsTo: 'Alex Rivera',
      teamSize: 2,
      children: [
        { id: 'na', name: 'Jamie Quinn', title: 'North America Sales', dept: 'Sales', email: 'jamie@grokclock.com', reportsTo: 'Casey Morgan', teamSize: 5, children: [
          { id: 'na1', name: 'Skyler Reed', title: 'Account Executive', dept: 'Sales', email: 'skyler@grokclock.com', reportsTo: 'Jamie Quinn', teamSize: 0, children: [] },
          { id: 'na2', name: 'Avery Lane', title: 'Account Executive', dept: 'Sales', email: 'avery@grokclock.com', reportsTo: 'Jamie Quinn', teamSize: 0, children: [] },
        ] },
        { id: 'eu', name: 'Riley Patel', title: 'Europe Sales', dept: 'Sales', email: 'riley@grokclock.com', reportsTo: 'Casey Morgan', teamSize: 4, children: [
          { id: 'eu1', name: 'Dakota Lane', title: 'Account Executive', dept: 'Sales', email: 'dakota@grokclock.com', reportsTo: 'Riley Patel', teamSize: 0, children: [] },
        ] },
      ],
    },
    {
      id: 'hr',
      name: 'Dana Morales',
      title: 'VP People',
      dept: 'HR',
      email: 'dana@grokclock.com',
      reportsTo: 'Alex Rivera',
      teamSize: 3,
      children: [
        { id: 'hr1', name: 'Peyton Blake', title: 'HR Manager', dept: 'HR', email: 'peyton@grokclock.com', reportsTo: 'Dana Morales', teamSize: 2, children: [] },
        { id: 'hr2', name: 'Sage Rivera', title: 'Recruiter', dept: 'HR', email: 'sage@grokclock.com', reportsTo: 'Dana Morales', teamSize: 0, children: [] },
      ],
    },
    {
      id: 'mkt',
      name: 'Drew Ellis',
      title: 'VP Marketing',
      dept: 'Marketing',
      email: 'drew@grokclock.com',
      reportsTo: 'Alex Rivera',
      teamSize: 3,
      children: [
        { id: 'mkt1', name: 'Harper Vale', title: 'Growth Lead', dept: 'Marketing', email: 'harper@grokclock.com', reportsTo: 'Drew Ellis', teamSize: 2, children: [] },
        { id: 'mkt2', name: 'Rowan Knox', title: 'Brand Designer', dept: 'Marketing', email: 'rowan@grokclock.com', reportsTo: 'Drew Ellis', teamSize: 0, children: [] },
      ],
    },
    {
      id: 'fin',
      name: 'Emerson Holt',
      title: 'CFO',
      dept: 'Finance',
      email: 'emerson@grokclock.com',
      reportsTo: 'Alex Rivera',
      teamSize: 2,
      children: [
        { id: 'fin1', name: 'Finley Quinn', title: 'Controller', dept: 'Finance', email: 'finley@grokclock.com', reportsTo: 'Emerson Holt', teamSize: 1, children: [] },
      ],
    },
  ],
}
