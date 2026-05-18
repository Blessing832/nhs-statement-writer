export interface ScotlandQ2Variation {
  id: string
  name: string
  angle: string
  text: string
}

export const SCOTLAND_Q2_VARIATIONS: ScotlandQ2Variation[] = [
  {
    id: '1',
    name: 'Values-Led',
    angle: 'Clinical governance, standards, and career culture',
    text: `NHS Scotland's commitment to dignified, person-centred care aligns with everything I believe healthcare should be. In my previous role, I supported patients through complex care pathways and saw firsthand how consistent standards and strong teamwork reduced adverse incidents on the ward. NHS Scotland's values, particularly openness and quality, reflect the working culture I want to grow in long-term. Scotland's approach to clinical governance, especially its focus on risk management and staff development, shows an organisation that invests in both patients and its people. I want to contribute to a health system that holds itself accountable and keeps improving. I am not just looking for a job. I want to build a career in an environment where care is treated as a professional responsibility, not just a function. NHS Scotland gives me that opportunity, and I am ready to bring my skills and commitment fully into it.`,
  },
  {
    id: '2',
    name: 'Career Growth Focus',
    angle: 'Professional development, governance pillars, structured progression',
    text: `I am applying to NHS Scotland because I want to work within a system that takes professional development seriously. The seven pillars of clinical governance, particularly education, training, and clinical effectiveness, tell me that NHS Scotland actively supports staff in growing their skills. In my current role, I completed mandatory training ahead of schedule and took on additional responsibilities mentoring new healthcare assistants, which strengthened my confidence in a leadership capacity. I want to develop further in a structured, high-standard environment. I chose Scotland specifically because the NHS here operates with clear frameworks and accountability structures that make career progression transparent and merit-based. I want to contribute to audit and improvement processes and take real ownership of my role. NHS Scotland, with its focus on quality and teamwork, is exactly the environment I need to reach my full potential as a healthcare professional.`,
  },
  {
    id: '3',
    name: 'Patient Impact Driven',
    angle: 'A specific career moment that led to this application',
    text: `My decision to apply to NHS Scotland comes from a specific moment in my career. I was supporting a patient who had been admitted repeatedly for the same condition. By flagging a gap in their discharge plan to the nursing team, we arranged proper community follow-up and the readmissions stopped. That experience showed me the power of a joined-up health system. NHS Scotland's clinical governance framework, with its pillars of patient involvement and clinical effectiveness, is built to enable exactly that kind of outcome. I want to work in a system that structures care around preventing problems, not just reacting to them. NHS Scotland's values of care, compassion, and teamwork match the way I already approach my work. I am applying because I want every shift I work to contribute to better patient outcomes within a system designed to support that goal.`,
  },
  {
    id: '4',
    name: 'Commitment to Standards',
    angle: 'Audit, quality improvement, and accountability culture',
    text: `I hold myself to high standards in everything I do, and I want to work for an organisation that does the same. In my previous healthcare role, I contributed to a ward audit that identified inconsistencies in manual handling documentation. I worked with the team lead to update the recording process, which improved compliance scores at the next review. That experience gave me a real appreciation for clinical audit and risk management as tools for genuine improvement, not just box-ticking. NHS Scotland's clinical governance framework takes those tools seriously. Its commitment to openness, honesty, and accountability matches the professional culture I want to be part of every day. I am applying to NHS Scotland because I want to bring that same attention to detail and drive for quality into a system that will challenge me, support my development, and help me grow into a more skilled and effective healthcare professional.`,
  },
  {
    id: '5',
    name: 'Teamwork and Culture Focused',
    angle: 'Collaborative improvement, handover, patient safety',
    text: `The best clinical outcomes I have been part of always came from strong team communication. In one role, our ward introduced a new handover checklist to reduce information gaps between shifts. I was part of the group that piloted it, gathered feedback from colleagues, and helped refine the format before it was rolled out across the unit. Patient safety incidents on our shift dropped noticeably over the following month. That experience shaped how I think about teamwork in healthcare. NHS Scotland's values, especially quality and teamwork, reflect the understanding that individual performance is only as good as the environment around it. NHS Scotland's staffing and staff management pillar shows me this is a system that builds that environment deliberately. I am applying because I want to keep doing that kind of collaborative, improvement-focused work within a health system that shares my belief in getting the basics right, consistently.`,
  },
  {
    id: '6',
    name: 'Long-Term Commitment',
    angle: 'Career investment, appraisal, values as personal standards',
    text: `I am not applying to NHS Scotland as a stepping stone. I am applying because I want to build my career here. Scotland's healthcare system has a reputation for investing in its workforce through structured training, appraisal, and development pathways. I have spent time researching NHS Scotland's approach to education and clinical effectiveness, and I am confident this is where I want to grow professionally over the long term. In my previous role, I consistently received positive feedback during appraisals for my reliability, patient communication, and willingness to take on additional tasks during busy periods. I want to bring that same work ethic into NHS Scotland and develop it further through access to better training, mentorship, and clinical experience. NHS Scotland's values of dignity, respect, and responsibility are not just professional expectations. They are personal standards I already hold myself to every day.`,
  },
]

export function getScotlandQ2Variation(id: string): ScotlandQ2Variation | undefined {
  return SCOTLAND_Q2_VARIATIONS.find((v) => v.id === id)
}
