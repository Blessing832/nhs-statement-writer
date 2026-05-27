-- Intake answers migration v2: uses client_code for exact matching
-- 34 candidates matched by client code from login log

-- 1. Wasiu
UPDATE clients SET
  q_difficult_situation = $$One night a resident I was supporting became very distressed and kept trying to get out of bed despite a falls risk. I stayed calm, sat close to him, spoke quietly, and held his hand until he settled. I did not restrain him. I just stayed present. He eventually fell asleep. I documented what happened and flagged it to the nurse so his care plan could be reviewed. It was a reminder that sometimes the most effective intervention is simply being there.$$,
  q_why_trust = $$[TRUST NAME] serves a community I genuinely want to be part of. The [SPECIFIC WARD OR SERVICE] aligns with the kind of work I find most meaningful. I looked at the Trust values before applying and they reflect how I already try to work every day.$$,
  q_colleagues_say = $$My colleagues tend to say I am steady. One senior carer once told me I am the person who keeps things moving without making a fuss. I think that is accurate. I show up on time, I finish what I start, and I do not leave things for the next shift if I can help it.$$,
  q_proudest_moment = $$A resident I had been caring for over several months was discharged home after a long recovery. On her last day she asked to speak to me specifically to say thank you. She said I had treated her like a person, not a patient. That stayed with me.$$,
  q_skills_equipment = $$I have used a Sara Stedy for standing transfers and a Rotunda for pivot turns. I am familiar with manual fluid balance charts, pressure area monitoring using the Waterlow scale, and completing daily observation records. I have also supported meal assistance for residents on modified texture diets following IDDSI guidance.$$
WHERE client_code = 'WASIUWIFE01';

-- 2. Fridah
UPDATE clients SET
  q_difficult_situation = $$A patient in my care had not eaten properly for three days. The kitchen kept sending standard meals but she found the texture difficult to manage. I spoke to the nurse and requested a referral to the dietitian. While waiting, I sat with her at mealtimes, offered fortified drinks like Ensure, and tried different approaches to encourage her. By day five her intake had improved. The dietitian confirmed malnutrition risk on assessment and the care plan was updated.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because of the [SPECIFIC DEPARTMENT OR SPECIALTY]. I have experience supporting patients with [RELEVANT PATIENT GROUP] and I feel this Trust is where I can build on that in a more structured way.$$,
  q_colleagues_say = $$People say I am patient. One nurse told me I have a gift for staying calm with patients who are difficult to reach. I think it comes from genuinely being curious about each person rather than just focusing on tasks.$$,
  q_proudest_moment = $$Supporting a young mother through her postnatal recovery was something I did not expect to be so meaningful. She was exhausted and a long way from family. I made sure she felt supported during personal care, explained everything clearly, and checked in on her throughout my shifts. She sent a thank-you card to the ward.$$,
  q_skills_equipment = $$I have experience with catheter care, wound dressing support under ANTT, and nasogastric feeding assistance. I am familiar with repositioning schedules for pressure area prevention and have used electronic care records for daily documentation.$$
WHERE client_code = 'NHSVJSPE';

-- 3. Nkem
UPDATE clients SET
  q_difficult_situation = $$A colleague made a comment during handover that I felt misrepresented a patient''s behaviour. The patient had dementia and my colleague was frustrated. I waited until after handover and spoke to her privately. I explained what I had observed and suggested a different approach. She was initially defensive but by the end of the shift she thanked me for saying something. I documented the interaction in the reflective log.$$,
  q_why_trust = $$[TRUST NAME] is known for its work in [CLINICAL AREA]. I have been following developments in that service and I want to be part of a team that takes [PATIENT POPULATION] seriously. The Trust values around inclusion also matter to me personally.$$,
  q_colleagues_say = $$My team leader described me as thorough. She said she never has to double-check my documentation because she knows it will be accurate. I take that seriously because I know records affect patient safety.$$,
  q_proudest_moment = $$I supported an elderly gentleman who had been in care for over a year but had very few visitors. I made a point of spending a little extra time talking with him during personal care. One afternoon he told me about his time working as a teacher. From that day I always asked him about it. His mood noticeably improved.$$,
  q_skills_equipment = $$I have completed training in Moving and Handling, Basic Life Support, and Infection Prevention and Control. I use NEWS2 observation charts, have experience with oral care protocols, and have assisted with personal care for patients with neurological conditions including stroke and Parkinson''s.$$
WHERE client_code = 'NHS67U4D';

-- 4. Prince
UPDATE clients SET
  q_difficult_situation = $$During a busy shift two call bells went off at the same time. One patient needed toileting assistance, the other was in pain and asking for the nurse. I assessed quickly, sent another carer to assist with toileting, and stayed with the patient in pain to reassure him and alert the nurse. When things calmed down I went back and checked on the first patient personally. Prioritising in that moment was not easy but I made the safest call I could.$$,
  q_why_trust = $$I chose [TRUST NAME] because of its reputation for [SPECIFIC INITIATIVE OR ACHIEVEMENT]. I want to work somewhere that takes staff development seriously and where I can grow into more senior responsibilities over time.$$,
  q_colleagues_say = $$Colleagues describe me as reliable and easy to work with. A senior carer once said she always feels better knowing I am on shift with her. I think consistency matters in care. You have to be someone the team and the patients can count on.$$,
  q_proudest_moment = $$A patient came in very frightened about a procedure. He had not slept properly and was refusing breakfast. I sat with him, explained what I knew about what would happen, and just listened. By the time the healthcare team came to collect him he was calmer. His family came to find me after the procedure to say thank you.$$,
  q_skills_equipment = $$I have experience supporting patients post-operatively, assisting with mobility using Zimmer frames and walking aids, monitoring vital signs using pulse oximetry and blood pressure cuffs, and completing fluid balance charts. I have also supported patients with PEG feed management under nurse supervision.$$
WHERE client_code = 'NHSUHTAK';

-- 5. Dora
UPDATE clients SET
  q_difficult_situation = $$A resident became very aggressive during personal care. She had a history of trauma and certain types of touch triggered distress. I stepped back, gave her space, and asked her what she needed. We agreed she would tell me when she was ready and I would follow her lead. It took longer than a standard care routine but she was calm throughout. I updated her care plan afterwards to reflect her preferences.$$,
  q_why_trust = $$I researched [TRUST NAME] before applying and I was impressed by [RECENT TRUST ACHIEVEMENT OR CQC RATING]. The [SPECIFIC WARD OR SERVICE] is where I feel my experience is most directly relevant. I want to contribute to a team doing that kind of work.$$,
  q_colleagues_say = $$My colleagues call me approachable. People tend to come to me when they are unsure about something, even when I am not the most senior person on shift. I think it is because I listen before I respond.$$,
  q_proudest_moment = $$I worked with a patient who had refused personal care for several days. Rather than pushing, I spent time building trust during meal assistance and brief check-ins. After four days she allowed me to support her with washing. She told me I was the first person who had not made her feel rushed.$$,
  q_skills_equipment = $$I have used hoists for full transfers, completed pressure area care using Mepilex and Aquacel dressings under supervision, and monitored patients using MUST nutritional screening tools. I am also experienced in supporting patients on end of life care pathways.$$
WHERE client_code = 'NHSWLU5B';

-- 6. Victor
UPDATE clients SET
  q_difficult_situation = $$I noticed a patient''s skin was looking red over her sacrum during repositioning. It had not been flagged in the previous handover. I documented it immediately, took a photograph for the wound care record, and escalated to the nurse. A tissue viability referral was made the same day. The early intervention prevented the area from breaking down further.$$,
  q_why_trust = $$[TRUST NAME] has a strong reputation for [CLINICAL AREA OR SPECIALTY]. I have worked with [RELEVANT PATIENT GROUP] and I want to develop further in that space. The Trust also operates in a community I feel connected to.$$,
  q_colleagues_say = $$My ward manager once said I notice things other people miss. I think that is the quality I am most proud of professionally. Observation matters in care. A lot of deterioration is preventable if someone is paying attention.$$,
  q_proudest_moment = $$A teenage patient who had been admitted following a mental health crisis was mostly silent during my shifts. I never forced conversation but I always checked in, offered to sit nearby, and made sure small things like her preferred pillow position were right. After two weeks she started talking to me. Her mother told the nurse that I had made a difference.$$,
  q_skills_equipment = $$I have completed training in safeguarding adults and children, have experience with catheter care and stoma bag management, and have assisted with pre and post-operative care including monitoring observations and documenting findings in electronic care systems.$$
WHERE client_code = 'NHSTW9TZ';

-- 7. Mona
UPDATE clients SET
  q_difficult_situation = $$A patient on my ward developed a sudden change in behaviour. He became confused and agitated overnight. I had been monitoring him and recognised this was different from his baseline. I escalated to the nurse immediately using SBAR communication. The on-call doctor was called and he was later diagnosed with a urinary tract infection. Quick escalation meant treatment started early.$$,
  q_why_trust = $$I want to join [TRUST NAME] because of its approach to [PATIENT GROUP OR SERVICE AREA]. I also appreciate the Trust''s investment in healthcare support staff development. I am at a point in my career where I want structured progression and a Trust that supports that.$$,
  q_colleagues_say = $$People say I am warm. Patients in particular seem to relax when I am on shift. One family member told the ward manager that their father always seemed more settled on the days I was working. That is the kind of feedback that means most to me.$$,
  q_proudest_moment = $$Supporting a patient through the final days of her life was the most significant experience of my care career. Her family lived abroad and could not travel in time. I sat with her, held her hand, and made sure she was not alone. I also kept her family updated by phone in coordination with the nurse. That experience shaped everything about how I approach end of life care.$$,
  q_skills_equipment = $$I am trained in syringe driver monitoring under nurse supervision, have experience supporting patients with dysphagia on modified diets, and have used digital care record systems for daily logging. I also hold a current Basic Life Support certificate.$$
WHERE client_code = 'NHS5277Y';

-- 8. Fisope
UPDATE clients SET
  q_difficult_situation = $$I made a documentation error once. I recorded the wrong time for a repositioning check. I noticed it before handover, corrected it with a countersignature from the nurse, and reported it to my supervisor. I did not try to cover it. That incident made me much more careful about real-time documentation rather than writing up at the end of a shift.$$,
  q_why_trust = $$I applied to [TRUST NAME] because of [SPECIFIC REASON TIED TO TRUST VALUES OR SERVICE]. I want to work somewhere I can contribute meaningfully and also continue to learn. The [SPECIFIC ROLE OR WARD] stood out because it matches the kind of patient work I am most experienced in.$$,
  q_colleagues_say = $$My colleagues describe me as honest and direct. One team leader told me she appreciates that I raise concerns early rather than waiting for things to get worse. I see that as part of the job, not just a personality trait.$$,
  q_proudest_moment = $$A patient who had recently been diagnosed with a long term condition was struggling to come to terms with it. He was not eating and barely speaking. I started spending a few minutes with him at the start of each shift just talking about everyday things. Over time he opened up. He told me he had been scared no one would treat him normally anymore.$$,
  q_skills_equipment = $$I have experience with manual handling using full body hoists and stand aids, completing daily living assessments, and supporting patients with personal care following neurological events including stroke. I also have basic IT skills and have used digital care management platforms for record keeping.$$
WHERE client_code = 'NHSQBGMP';

-- 9. Derick
UPDATE clients SET
  q_difficult_situation = $$A new patient arrived on the ward in a very distressed state. She had been waiting in A and E for hours and was exhausted. Rather than moving straight into the admission routine, I got her settled first, made sure she had a drink, and gave her a few minutes before we started. She thanked me specifically for that. The paperwork got done. But the way we do it matters.$$,
  q_why_trust = $$[TRUST NAME] has made significant progress in [CLINICAL AREA OR QUALITY INITIATIVE] recently. I follow developments in NHS healthcare and I was genuinely impressed by [SPECIFIC ACHIEVEMENT]. That is the kind of organisation I want to be part of.$$,
  q_colleagues_say = $$Colleagues say I am efficient without being cold. That balance is something I work at deliberately. Care should be thorough and timely but never rushed in a way the patient can feel.$$,
  q_proudest_moment = $$I cared for a patient with advanced dementia who became very distressed each evening. The team had tried several approaches. I noticed he seemed to respond to music from a particular era and suggested to the nurse that we try playing it during his evening care routine. It worked consistently. His family were moved when they visited and saw the difference.$$,
  q_skills_equipment = $$I have training in dementia awareness, experience with MUST nutritional screening, and have supported patients with complex personal care needs including continence care and catheter management. I also completed a Moving and Handling refresher within the last twelve months.$$
WHERE client_code = 'NHSJ7EBR';

-- 10. Abigail
UPDATE clients SET
  q_difficult_situation = $$I was working a night shift when a post-operative patient''s blood pressure dropped suddenly. I assessed immediately, checked her airway, breathing, and circulation, and escalated to the on-call doctor using SBAR. While waiting I positioned her appropriately, increased her oxygen, and rechecked observations every five minutes. She was transferred to HDU within thirty minutes. The consultant later said early recognition was key.$$,
  q_why_trust = $$[TRUST NAME] is a Trust I have followed for some time. The [SPECIFIC DEPARTMENT OR SPECIALITY] is known for its clinical standards and I want to develop my nursing career in that environment. I also value the Trust''s approach to [VALUE OR INITIATIVE FROM TRUST WEBSITE].$$,
  q_colleagues_say = $$My colleagues describe me as methodical and calm under pressure. One charge nurse told me I make people around me feel steadier when situations escalate. I think that comes from trusting the training and focusing on what can be controlled.$$,
  q_proudest_moment = $$As a nursing student I cared for a patient who had been told her treatment had stopped working. The consultant had broken the news and then moved on. I sat with her for over an hour. I did not have answers. But she told me having someone stay was what she needed. That interaction is why I became a nurse.$$,
  q_skills_equipment = $$I am proficient in IV cannulation, wound assessment and management using ANTT, urinary catheterisation, nasogastric tube insertion, medication administration including controlled drugs, and fluid balance monitoring. I have worked with EPR systems and paper-based observation charts. I hold a current NMC pin.$$
WHERE client_code = 'NHSYVLB4';

-- 11. Lateef
UPDATE clients SET
  q_difficult_situation = $$A patient refused his medication three days in a row. Rather than escalating immediately I asked him why. He told me he was worried about side effects he had read about online. I listened without dismissing his concerns, explained what I understood, and told the nurse so she could speak with him properly. He eventually agreed to take the medication after a proper conversation with the prescriber. Listening first changed the outcome.$$,
  q_why_trust = $$I am drawn to [TRUST NAME] because of its focus on [PATIENT GROUP OR SERVICE]. The [SPECIFIC UNIT OR WARD] is somewhere I can see myself contributing in a meaningful way. I also know the Trust has invested in [DEVELOPMENT PROGRAMME OR INITIATIVE] which shows commitment to staff as well as patients.$$,
  q_colleagues_say = $$People describe me as someone who takes initiative. My supervisor once said I was the kind of person who fixes problems quietly before they become issues for anyone else to deal with.$$,
  q_proudest_moment = $$I supported a patient who had been in hospital for over six weeks following a fall. His confidence had dropped significantly. With agreement from the nurse I started incorporating small daily goals into his personal care routine, like standing independently for thirty seconds. By his last week he was walking to the bathroom with minimal support.$$,
  q_skills_equipment = $$I have experience supporting rehabilitation patients with mobility exercises under physiotherapist guidance, using Zimmer frames and rollators, completing falls risk assessments using the STRATIFY tool, and monitoring recovery through daily observation records.$$
WHERE client_code = 'NHSNQ63J';

-- 12. Asmau
UPDATE clients SET
  q_difficult_situation = $$During a shift I was allocated more patients than usual because of sickness. I told my supervisor before the shift started so she was aware. I prioritised by clinical need, flagged anything I could not complete to the nurse in charge, and did not cut corners on essential care. At the end of the shift I documented everything I had and had not done and explained why. Transparency when under pressure is something I feel strongly about.$$,
  q_why_trust = $$[TRUST NAME] stands out to me because of [SPECIFIC TRUST VALUE OR RECENT ACHIEVEMENT]. I want to work in an environment that prioritises [CLINICAL AREA OR PATIENT GROUP] and where I can grow alongside people who take their work seriously.$$,
  q_colleagues_say = $$My colleagues say I am organised. One nurse told me she can always tell when I have been on shift before her because everything is documented clearly and the bay is tidy. I find that kind of reliability satisfying to maintain.$$,
  q_proudest_moment = $$I worked alongside a senior carer who had a very different approach to care from mine. Rather than avoiding the tension I asked her about her methods one quiet afternoon. We ended up having a long conversation about where our approaches overlapped. That relationship became one of the most useful in my career.$$,
  q_skills_equipment = $$I have experience with nutrition and hydration monitoring including MUST scores, assisted feeding for patients with swallowing difficulties, personal care for bariatric patients, and documentation in both paper-based and digital care record systems.$$
WHERE client_code = 'NHSYDYRM';

-- 13. Leo Kariuki
UPDATE clients SET
  q_difficult_situation = $$I was caring for a patient whose family were unhappy with his care and made a formal complaint while I was on shift. I remained calm, listened to their concerns fully, apologised for any distress caused without making admissions, and immediately involved the nurse in charge. I also made sure the patient himself knew what was happening and that his voice would be heard in the process.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because of its strong track record in [CLINICAL AREA]. Having worked with [PATIENT GROUP] I understand the complexity of this patient group and I am motivated to develop my practice in an acute NHS setting.$$,
  q_colleagues_say = $$My manager describes me as someone who raises the standard just by being present. I think that is about consistency rather than effort. I work the same way whether or not someone is watching.$$,
  q_proudest_moment = $$A patient from a different cultural background was uncomfortable with mixed gender personal care. This had not been documented in the care plan. I flagged it to the nurse, arranged for a same-gender carer to take over, and made sure the preference was documented clearly so every subsequent shift respected it.$$,
  q_skills_equipment = $$I have training in infection prevention and control, safeguarding adults level 2, and have experience with neurological observation monitoring including GCS scoring support. I also have experience with stoma care and wound dressing support under registered nurse supervision.$$
WHERE client_code = 'NHS6F5ZN';

-- 14. Abass
UPDATE clients SET
  q_difficult_situation = $$Early in my care career I struggled with time management on busy shifts. I spoke to my supervisor and she helped me develop a habit of completing a brief mental priority list at the start of each shift. That simple change made a significant difference. I no longer wait to be told what is most urgent. I assess and act.$$,
  q_why_trust = $$[TRUST NAME] offers the kind of clinical environment I am ready for. The [SPECIFIC SERVICE OR WARD] is particularly relevant to my experience with [PATIENT GROUP]. I also value the Trust''s commitment to [STAFF VALUE OR DIVERSITY INITIATIVE].$$,
  q_colleagues_say = $$Colleagues say I am good with anxious patients. I think it is because I do not rush them. When someone is frightened the temptation is to keep moving but sometimes stopping completely is the most effective thing you can do.$$,
  q_proudest_moment = $$A patient was admitted following a suicide attempt. He was physically stable but emotionally withdrawn. I was not his named carer but I checked in on him quietly throughout my shifts. I did not press him to talk. I just made sure he knew someone was paying attention. His nurse thanked me at the end of the week.$$,
  q_skills_equipment = $$I have experience supporting patients following self-harm and mental health admissions, completing routine clinical observations, assisting with personal care for patients with limited mobility, and using electronic handover systems. I have also completed mental health awareness training.$$
WHERE client_code = 'NHS7PFMZ';

-- 15. Shakirat
UPDATE clients SET
  q_difficult_situation = $$A patient I was supporting had a language barrier and found it difficult to communicate pain. I noticed she was grimacing during repositioning and guarding her abdomen. I escalated to the nurse even though she had not verbally complained. The nurse assessed her and found she was in significant discomfort. Pain management was adjusted. Non-verbal observation is something I take very seriously.$$,
  q_why_trust = $$I applied to [TRUST NAME] because of [SPECIFIC DEPARTMENT OR COMMUNITY FOCUS]. I am particularly motivated by the Trust''s work with [PATIENT GROUP OR DEMOGRAPHIC] and I believe my experience in [PREVIOUS CARE SETTING] has prepared me well for this environment.$$,
  q_colleagues_say = $$People say I am observant. My team leader once said she trusts my clinical instincts because I pay attention to the details that others can miss in a busy shift.$$,
  q_proudest_moment = $$I once supported a patient during a very difficult conversation where she was told her family could not be present due to infection control restrictions. She was devastated. I stayed with her, held her hand, and we spoke on the phone with her daughter together. It was a small thing but it mattered enormously to both of them.$$,
  q_skills_equipment = $$I have experience with palliative care support, completing personal care for patients with complex needs, assisting with oral hygiene using foam swabs for patients unable to self-care, and monitoring patients using syringe driver documentation sheets under nurse supervision.$$
WHERE client_code = 'NHSKL369';

-- 16. Shinaayomi
UPDATE clients SET
  q_difficult_situation = $$I was asked to complete a task I was not trained for by a busy nurse during a short-staffed shift. I declined politely and explained clearly that I was not competent in that area. I offered to help in another way instead. The nurse understood and arranged for someone qualified to complete it. Knowing your scope is not weakness. It is patient safety.$$,
  q_why_trust = $$[TRUST NAME] is somewhere I have wanted to work since I started my healthcare career. The [SPECIFIC WARD OR SPECIALTY] is directly relevant to my training and experience. I also know the Trust has [RECENT ACHIEVEMENT OR QUALITY RATING] which tells me care standards here are high.$$,
  q_colleagues_say = $$My colleagues describe me as eager to learn. One senior carer said she enjoys supervising me because I ask the right questions. I take that as a sign I am developing good clinical judgment.$$,
  q_proudest_moment = $$During a placement I worked with a patient who had been told he would not walk again. He had become very angry and was difficult to engage with. I did not take his frustration personally. I kept showing up, kept my tone even, and over time he allowed me to support him. He apologised one afternoon for how he had been at the start.$$,
  q_skills_equipment = $$I have completed my Care Certificate, training in infection prevention and control, safeguarding awareness, and have experience supporting patients with personal hygiene, nutrition, and mobility. I am familiar with using NEWS2 observation charts and escalating concerns to senior staff.$$
WHERE client_code = 'NHSTEAE3';

-- 17. Ogene
UPDATE clients SET
  q_difficult_situation = $$I supported a patient who had a complex wound following surgery. The district nurse visited regularly but between visits I was responsible for monitoring the site. I noticed an increase in redness and warmth around the wound edges and documented it with a photograph. I alerted the nurse coordinator before the next scheduled visit. Early intervention meant the wound did not deteriorate further.$$,
  q_why_trust = $$I want to join [TRUST NAME] because of its investment in [CLINICAL AREA OR STAFF DEVELOPMENT]. The [SPECIFIC SERVICE] is something I am passionate about and I believe the Trust environment would support me to continue developing in that direction.$$,
  q_colleagues_say = $$My previous manager said I was the kind of person who makes a ward feel calmer. I do not think I do anything dramatic. I just try to keep things steady and communicate clearly when things are changing.$$,
  q_proudest_moment = $$A patient with severe anxiety refused to be washed by anyone other than one specific carer. That carer left the team. I volunteered to gradually introduce myself over several days, starting with brief interactions, then offering small tasks. Within two weeks she allowed me to support her fully. The nurse said it was one of the most patient pieces of relationship building she had witnessed.$$,
  q_skills_equipment = $$I have experience with wound monitoring and documentation, supporting patients with complex anxiety presentations, completing personal care for adults with learning disabilities, and using digital care platforms. I have also completed level 2 safeguarding training.$$
WHERE client_code = 'NHSQDFXQ';

-- 18. Bolu
UPDATE clients SET
  q_difficult_situation = $$A patient told me something in confidence that raised a safeguarding concern. She asked me not to tell anyone. I explained clearly and kindly that I had a duty of care that meant I had to share the information with the nurse in charge, but that I would do it in a way that protected her dignity. She was upset initially but later told me she was glad I had acted. Confidentiality has limits and being honest about that is important.$$,
  q_why_trust = $$[TRUST NAME] is an organisation I have researched carefully. The [SPECIFIC SERVICE OR COMMUNITY PROGRAMME] aligns directly with my experience. I also feel the Trust''s approach to [STAFF VALUE OR DEI INITIATIVE] reflects my own values.$$,
  q_colleagues_say = $$My colleagues say I handle difficult conversations well. A team leader once told me she sends me into situations with upset relatives because I have a way of making people feel heard without making promises I cannot keep.$$,
  q_proudest_moment = $$One of the most meaningful moments in my care career was supporting a patient on her final birthday in the care home. Her family could not visit. I arranged with the kitchen for a small cake and made sure her favourite music was playing. She cried. I did too. Small things are not small.$$,
  q_skills_equipment = $$I have experience with end of life care, including mouth care using foam swabs, repositioning on a two-hourly schedule to prevent pressure damage, and supporting family members during the dying process. I have also completed a Dignity in Care module as part of my professional development.$$
WHERE client_code = 'NHSK76WQ';

-- 19. Angela
UPDATE clients SET
  q_difficult_situation = $$A patient''s family raised concerns about his weight loss with me directly rather than through the nursing team. I listened carefully, thanked them for raising it, and told them I would pass it on to the nurse in charge immediately. I did not dismiss it or tell them to come back later. Families often notice changes that the clinical team can miss in a busy environment.$$,
  q_why_trust = $$I have followed [TRUST NAME] for some time and the [SPECIFIC DEPARTMENT] matches exactly the area where I want to develop. I am particularly drawn to the Trust''s [VALUE OR RECENT INITIATIVE] and how it has shaped patient outcomes in [CLINICAL AREA].$$,
  q_colleagues_say = $$People describe me as dependable. My previous supervisor said she never had to follow up with me on tasks. If I said I would do something it was done and documented before the end of the shift.$$,
  q_proudest_moment = $$I worked with a patient who had recently lost her husband and been admitted shortly after. She was grieving as much as she was unwell. I made sure during personal care I gave her space to talk if she wanted and never rushed her through the routine. She told me I reminded her of her daughter. That stays with me.$$,
  q_skills_equipment = $$I have completed bereavement awareness training and have experience supporting patients with emotional distress alongside physical care needs. I am also experienced in completing food and fluid intake charts, assisting with nutritional supplements, and supporting patients with dysphagia on thickened fluids.$$
WHERE client_code = 'NHSVYBSS';

-- 20. Motun Filani
UPDATE clients SET
  q_difficult_situation = $$During an inspection visit I was asked by an assessor about my approach to infection control. I walked her through my hand hygiene routine, explained the five moments of hand hygiene, and demonstrated how I don appropriate PPE before personal care. She gave positive feedback to the ward manager. I do not change my practice for inspections. What she saw was a normal shift.$$,
  q_why_trust = $$[TRUST NAME] is a place I actively want to work rather than simply applying broadly. The [SPECIFIC WARD OR SERVICE] and the Trust''s recent [CQC OUTCOME OR INITIATIVE] show this is an organisation with strong clinical governance. That matters to me.$$,
  q_colleagues_say = $$My manager says I set a quiet example. She told me newer staff gravitate toward my way of working because it is calm and consistent. I find that satisfying because it suggests good habits are transferable.$$,
  q_proudest_moment = $$A patient who was newly diagnosed with a life-limiting condition spent a lot of time crying during my shifts. I did not try to fix it. I sat nearby, completed tasks quietly, and let her set the pace for interaction. One afternoon she said ''you are the only one who does not look uncomfortable around me.'' That taught me that presence is a clinical skill.$$,
  q_skills_equipment = $$I have experience supporting patients with end stage respiratory conditions, completing oxygen saturation monitoring, assisting with nebuliser preparation under nurse supervision, and maintaining accurate fluid balance documentation. I have also completed intermediate level infection control training.$$
WHERE client_code = 'NHSST8E8';

-- 21. Betty
UPDATE clients SET
  q_difficult_situation = $$I supported a patient through a procedure she was very frightened about. She had a needle phobia and needed blood drawn. Rather than calling it simple or dismissing her fear I acknowledged it fully, helped her focus on her breathing, and asked the phlebotomist to talk her through every step before doing anything. The procedure was completed. She thanked me specifically for treating her fear as real.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because [SPECIFIC REASON LINKED TO TRUST REPUTATION OR SERVICE]. The [SPECIFIC ROLE OR WARD] would allow me to build on my existing skills in [RELEVANT CARE AREA] within a well-resourced NHS environment.$$,
  q_colleagues_say = $$Colleagues describe me as thorough and caring in equal measure. My team leader said I never treat care as a checklist. Everything I do, I do with the patient as a person in mind.$$,
  q_proudest_moment = $$A patient under my care was not communicating verbally due to a stroke. I learned her preferred routines from her family and made sure every carer on our team knew them too. I updated her care plan with specific preferences including how she liked her hair brushed and which side of the bed she preferred to be approached from. That level of detail changes the experience for the patient.$$,
  q_skills_equipment = $$I have experience with stroke care, including supporting patients with communication aids, completing assisted washing and dressing for patients with hemiplegia, and working with speech and language therapy guidance for patients on modified texture diets.$$
WHERE client_code = 'NHSED93P';

-- 22. Bosei
UPDATE clients SET
  q_difficult_situation = $$A patient I was supporting deteriorated during a night shift. He had been slightly confused at the start of the shift but by midnight he was unresponsive. I escalated immediately, kept the airway clear, and stayed with him until the nurse arrived. He was later stabilised. The nurse told me my early decision to escalate rather than wait for the next check made a difference.$$,
  q_why_trust = $$[TRUST NAME] is a Trust I have specifically targeted in my applications. The [SPECIFIC WARD OR SPECIALTY] represents the kind of clinical environment where I know I can contribute effectively. I also value the Trust''s approach to [INCLUSION OR QUALITY INITIATIVE].$$,
  q_colleagues_say = $$People say I remain calm in emergencies. I think it is because I trust the training and focus on what I can actually control in the moment. Panic does not help patients.$$,
  q_proudest_moment = $$I worked with a patient who had been in a care home for three years following a brain injury. He communicated through an eye gaze device. Most of the team found it slow and frustrating. I spent time learning his communication rhythms and we developed a shorthand. His occupational therapist told me it was the most progress he had made in two years.$$,
  q_skills_equipment = $$I have experience supporting patients with acquired brain injuries, using AAC communication aids, completing personal care for patients with high dependency needs, and monitoring patients using Glasgow Coma Scale charts under nurse supervision.$$
WHERE client_code = 'NHSBVM8A';

-- 23. Gbemi
UPDATE clients SET
  q_difficult_situation = $$I had a disagreement with a colleague during a shift about how a patient''s personal care should be approached. Rather than escalating it I suggested we each explain our reasoning and then ask the senior carer for guidance. The senior carer agreed with my approach but acknowledged my colleague''s concern too. I think the way we resolve disagreements matters as much as what we decide.$$,
  q_why_trust = $$I applied to [TRUST NAME] because of its [SPECIFIC PROGRAMME OR CLINICAL REPUTATION]. I am currently on a [COURSE OR STUDY PATHWAY] and I want to work in an environment where my learning is supported by clinical practice. The Trust''s commitment to [STAFF DEVELOPMENT OR TRAINING] stood out when I researched the role.$$,
  q_colleagues_say = $$My colleagues describe me as someone who asks good questions. A senior carer told me I have a way of questioning things that does not feel challenging. It just feels like I am trying to understand.$$,
  q_proudest_moment = $$During a particularly hard week when the ward had lost two long-term residents, I noticed the team morale was low. I organised a brief informal debrief at the end of a shift, just a few minutes in the staff room. Nobody was required to speak. But several colleagues told me afterwards it had helped. Looking after each other is part of the job.$$,
  q_skills_equipment = $$I have experience supporting bereaved families, completing verification of death documentation support under nurse supervision, providing personal care following death in line with cultural preferences, and documenting end of life care activities in digital care records.$$
WHERE client_code = 'NHSDGJE2';

-- 24. Olatoye
UPDATE clients SET
  q_difficult_situation = $$I was asked to cover a ward I had not worked on before at short notice. I arrived early, introduced myself to the team, and asked for a brief orientation before the shift started. I was upfront about being unfamiliar with the layout and some of the patients. By the end of the shift the nurse in charge told me she could not tell it was my first time there. Adaptability is something I have deliberately built.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because the [SPECIFIC WARD OR DEPARTMENT] is an environment where my skills are most relevant. I have also read about the Trust''s [RECENT NEWS OR DEVELOPMENT] and it reflects the kind of quality commitment I want to work within.$$,
  q_colleagues_say = $$People say I am flexible. Not just in terms of shifts, but in how I approach new situations. I do not need everything to be familiar before I can perform well.$$,
  q_proudest_moment = $$A patient who was being discharged home after a long admission was very anxious about managing alone. I sat with her during my break and helped her write a list of things she felt confident about and things she was unsure of. I passed the list to the discharge nurse. The patient told me it was the most useful conversation she had had during her stay.$$,
  q_skills_equipment = $$I have experience supporting patients through discharge planning, completing personal care assessments for community transition, and liaising with social care teams under nurse coordination. I also have experience with manual handling of bariatric patients and have completed relevant equipment training.$$
WHERE client_code = 'NHSTMNZE';

-- 25. Oma
UPDATE clients SET
  q_difficult_situation = $$A patient complained that her pain had not been managed properly on the previous shift. I did not defend the previous team. I listened, documented her concern, escalated to the nurse, and made sure the pain assessment was reviewed before the end of my shift. She told me she felt heard for the first time since admission.$$,
  q_why_trust = $$[TRUST NAME] has a strong reputation in [CLINICAL AREA]. I have experience with [RELEVANT PATIENT GROUP] and I am looking for a Trust where that experience is valued and built upon. I also want to work somewhere with a clear pathway for healthcare support workers to develop.$$,
  q_colleagues_say = $$My previous manager called me proactive. She said I do not wait to be asked to do things. If I see something that needs doing I do it, or I ask if it is within my scope.$$,
  q_proudest_moment = $$I supported a patient who had been admitted following domestic violence. She was frightened and distrustful of everyone. I did not push for information. I just made sure every interaction I had with her was predictable, gentle, and consistent. After several days she asked to speak to the nurse about what had happened. I was told my approach had helped her feel safe enough to disclose.$$,
  q_skills_equipment = $$I have completed safeguarding adults and children level 3, have experience supporting patients in trauma-informed care settings, and have completed Domestic Abuse awareness training. I also have experience with risk assessment documentation and multi-agency safeguarding referral processes.$$
WHERE client_code = 'NHSVGX4W';

-- 26. Nazif
UPDATE clients SET
  q_difficult_situation = $$I was supporting a maternity patient who became very distressed following a difficult birth. Her partner was not present and she was asking for him repeatedly. I stayed with her, offered reassurance, and helped the midwife locate and contact her partner. While we waited I kept her calm through focused breathing guidance. When her partner arrived she broke down in relief. Being present during those moments is something I take seriously.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because the [MATERNITY OR SPECIFIC UNIT] aligns with my experience and career focus. I am particularly drawn to the Trust''s approach to [PATIENT CENTRED MATERNITY CARE OR SPECIFIC INITIATIVE] and I believe I can contribute meaningfully to the team.$$,
  q_colleagues_say = $$Colleagues describe me as calm and steady. A midwife once told me she trusts me in high-pressure situations because I do not add to the noise. I focus on what the patient needs in that moment.$$,
  q_proudest_moment = $$A patient who had experienced a previous pregnancy loss was admitted to the maternity ward for monitoring. She was visibly terrified throughout. I made sure during every interaction I acknowledged how she was feeling without dismissing her fear. I let her lead the pace of everything. She later sent a card to the ward.$$,
  q_skills_equipment = $$I have experience supporting maternity patients during antenatal and postnatal care, assisting with breastfeeding support under midwife supervision, completing newborn care including bathing and skin monitoring, and documenting maternal observations including blood pressure and oxygen saturation.$$
WHERE client_code = 'NHS6UTPD';

-- 27. Oloye
UPDATE clients SET
  q_difficult_situation = $$During a medication round a discrepancy appeared between the drug chart and what was physically available. I did not administer anything. I immediately reported it to the nurse in charge and waited while it was resolved. It turned out to be an administration error from the previous shift. My decision to pause rather than improvise was the right one.$$,
  q_why_trust = $$I applied to [TRUST NAME] because of [SPECIFIC REASON LINKED TO TRUST OR SERVICE]. The role fits my current experience and I see it as a clear next step in a career direction I have been building deliberately.$$,
  q_colleagues_say = $$People say I am grounded. My supervisor told me I am one of the few people she can send into difficult family conversations without worrying. I stay on message, stay calm, and I do not get pulled into emotional escalation.$$,
  q_proudest_moment = $$I worked with a patient recovering from a stroke who had become very withdrawn. His speech was affected and he found interactions frustrating. I started writing notes on a small whiteboard so he could respond at his own pace. He started looking forward to our interactions. His occupational therapist noticed the change and asked what I had been doing.$$,
  q_skills_equipment = $$I have experience supporting patients with communication impairments including aphasia, using alternative communication strategies, completing daily living assessments, and assisting with neurological observations including limb strength and coordination monitoring.$$
WHERE client_code = 'NHSN9PSG';

-- 28. Timo
UPDATE clients SET
  q_difficult_situation = $$I once raised a concern about a practice I observed that I felt was not in keeping with the dignity policy. I did it privately with the colleague first and then with the team leader when the behaviour continued. It was not a comfortable thing to do. But I believe patients cannot always advocate for themselves and that makes it my responsibility.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because of its clear commitment to [TRUST VALUE OR CLINICAL PRIORITY]. The [SPECIFIC WARD] also offers exposure to [PATIENT GROUP OR CLINICAL AREA] that I have experience with and want to develop further.$$,
  q_colleagues_say = $$Colleagues call me principled. I set a standard for myself and I try not to lower it under pressure. My team leader once said she can trust me to do the right thing even when no one is looking.$$,
  q_proudest_moment = $$A patient I had been caring for over several months passed away during my shift. I had known him well. I completed the required care and documentation and then went to speak with the nurse about how I was feeling. She later told me she appreciated that I had not tried to suppress it. Looking after yourself means you can look after others.$$,
  q_skills_equipment = $$I have completed end of life care training including Last Offices, have experience with supporting grieving families in the immediate aftermath of death, and have completed a personal resilience module as part of my care development programme.$$
WHERE client_code = 'NHS7N7N4';

-- 29. Ola
UPDATE clients SET
  q_difficult_situation = $$I was working when a patient fell in the bathroom. I had not been in the room but heard the impact. I responded immediately, assessed for injury, kept her still, and called for the nurse. I did not move her until the nurse arrived and directed. I completed a full incident report documenting exactly what I had and had not seen. Falls documentation is something I treat with complete accuracy.$$,
  q_why_trust = $$[TRUST NAME] is somewhere I have wanted to work for some time. The [SPECIFIC DEPARTMENT OR WARD] is directly relevant to my clinical experience and I believe the Trust''s approach to [PATIENT SAFETY OR QUALITY INITIATIVE] is exactly the environment where I can develop.$$,
  q_colleagues_say = $$My colleagues say I am dependable in a crisis. A nurse told me she feels confident when I am on shift because she knows if something happens I will respond correctly and document accurately.$$,
  q_proudest_moment = $$A patient who had been refusing food for days finally accepted a meal when I sat with him and ate my lunch nearby. We talked about food from his country of origin. He told me it was the first time in weeks he had felt normal. Sometimes clinical care just means being a person with someone.$$,
  q_skills_equipment = $$I have experience with falls risk management including completing STRATIFY assessments, post-fall monitoring protocols, incident documentation, and supporting rehabilitation following falls. I have also completed manual handling refresher training within the last year.$$
WHERE client_code = 'NHS4C8P7';

-- 30. Hope
UPDATE clients SET
  q_difficult_situation = $$A patient in my care told me she did not want to be resuscitated but was afraid her family would override her wishes. I listened carefully, told her her voice mattered, and made sure the nurse was informed that the patient wanted to discuss her DNACPR status formally. I did not make promises but I made sure the right people knew it was urgent. She later told me she was relieved.$$,
  q_why_trust = $$I want to work at [TRUST NAME] because of the Trust''s approach to [PATIENT RIGHTS OR ADVANCE CARE PLANNING]. I am particularly interested in the [SPECIFIC WARD OR SPECIALTY] and I feel my experience with [PATIENT GROUP] has prepared me for the complexity of this environment.$$,
  q_colleagues_say = $$My colleagues describe me as an advocate. One nurse told me patients seem to trust me quickly and that they share things with me they have not said to anyone else. I take that seriously and I always ensure what they share is acted on appropriately.$$,
  q_proudest_moment = $$I supported a patient with a learning disability who was admitted to an acute ward and found the environment very distressing. I created a simple routine card with her key worker and made sure every carer on the ward had a copy. Her distress episodes reduced significantly within three days.$$,
  q_skills_equipment = $$I have completed learning disability awareness training, have experience supporting patients with autism spectrum conditions in hospital settings, and have used easy-read resources and visual schedules to support communication. I also hold a current Makaton communication awareness certificate.$$
WHERE client_code = 'NHSGV8PW';

-- 31. Ife
UPDATE clients SET
  q_difficult_situation = $$A patient''s relative called the ward at 2am when I was on a night shift. She was worried about her father and distressed. I stayed on the phone with her for fifteen minutes, answered what I could, and promised to ask the nurse to call her back within the hour. I made sure that happened. She called again the following morning to thank the team.$$,
  q_why_trust = $$I am drawn to [TRUST NAME] because of its [SPECIFIC SERVICE OR COMMUNITY FOCUS]. I have experience working with [PATIENT GROUP] and I want to develop that experience within a larger NHS structure where specialist support is available.$$,
  q_colleagues_say = $$People describe me as reliable and warm. A family member once left a review that specifically mentioned my name and described me as someone who made a frightening experience feel safer. That kind of feedback matters to me more than any formal recognition.$$,
  q_proudest_moment = $$Supporting a patient with advanced dementia through her final weeks was one of the most significant experiences of my care career. Her family lived far away and visited rarely. I made sure she had music, her favourite blanket, and familiar smells nearby. I updated the family by phone regularly. Her daughter told me at the end that I had given her mother a good death.$$,
  q_skills_equipment = $$I have experience supporting patients with advanced dementia in palliative stages, completing comfort care documentation, assisting with family communication under nurse coordination, and completing observational monitoring for patients no longer able to report symptoms.$$
WHERE client_code = 'NHS5L8PJ';

-- 32. Luma
UPDATE clients SET
  q_difficult_situation = $$I was supporting a patient through discharge planning when I realised he did not fully understand the instructions he had been given. He was nodding along but I could tell he was confused. I quietly asked him to explain back to me what he had been told. He could not. I informed the nurse and a clearer explanation was arranged. Discharge failures often start with assumptions about understanding.$$,
  q_why_trust = $$I want to join [TRUST NAME] because of its work in [PROACTIVE CARE OR COMMUNITY HEALTH]. The Proactive Care Coordinator role in particular aligns with how I believe healthcare should work, identifying need early and acting before crisis. The Trust''s approach to [SPECIFIC INITIATIVE OR POPULATION HEALTH] confirms that.$$,
  q_colleagues_say = $$My colleagues say I think ahead. A senior carer told me I am always one step ahead of what a patient needs. I think it comes from listening carefully and connecting what someone says to what their care plan says.$$,
  q_proudest_moment = $$During a community health outreach I visited a patient who had missed two appointments. When I arrived he was clearly struggling at home but refusing formal support. I did not push. I visited again the following week. By the third visit he agreed to a care package. That patience changed his trajectory.$$,
  q_skills_equipment = $$I have experience with proactive care coordination, completing holistic needs assessments, liaising with GP practices and social care teams, supporting patients with long term conditions including diabetes and heart failure, and using electronic patient record systems for care planning documentation.$$
WHERE client_code = 'NHSRAEDZ';

-- 33. Joke
UPDATE clients SET
  q_difficult_situation = $$I noticed a pattern over several weeks that a particular patient''s pain scores were consistently higher on certain days. I mentioned it to the nurse and suggested it might correlate with her physiotherapy sessions. The nurse reviewed the timing of her analgesia and adjusted it. The patient''s comfort during sessions improved noticeably. Patterns matter in care.$$,
  q_why_trust = $$I applied to [TRUST NAME] because of its focus on [CLINICAL AREA OR PATIENT GROUP]. I have experience in [RELEVANT CARE SETTING] and I believe the Trust environment will allow me to apply that experience at a higher level. I was also impressed by [SPECIFIC TRUST ACHIEVEMENT OR QUALITY PROGRAMME].$$,
  q_colleagues_say = $$Colleagues describe me as analytical for a carer. I think about why things work, not just that they do. My team leader said that kind of curiosity is rare and she tries to put me on shifts with newer staff so the habit spreads.$$,
  q_proudest_moment = $$I supported a patient through the loss of her ability to walk independently. She went from being mobile to wheelchair dependent during my time caring for her. I supported her practically through the transition and also emotionally, acknowledging each small loss without catastrophising it. Her consultant noted her psychological adjustment as unusually positive.$$,
  q_skills_equipment = $$I have experience supporting patients through functional decline, completing mobility reassessments under physiotherapist guidance, assisting with manual wheelchair use, completing repositioning schedules for wheelchair users, and documenting changes in functional status in electronic care records.$$
WHERE client_code = 'NHS5X2F8';

-- 34. Lola
UPDATE clients SET
  q_difficult_situation = $$During my first week in a new role I made an error in a care record. I corrected it immediately with the proper countersignature and reported it to my supervisor without being asked. She told me later that how I handled it told her more about my character than the error itself. I do not believe in hiding mistakes. Transparency protects patients.$$,
  q_why_trust = $$I chose to apply to [TRUST NAME] because of [SPECIFIC REASON CONNECTED TO TRUST REPUTATION OR RECENT NEWS]. The [SPECIFIC WARD OR SERVICE] matches my experience and I see this role as a clear development step in the direction I am heading.$$,
  q_colleagues_say = $$My colleagues say I grow quickly. A team leader told me that in the first three months I had moved from needing guidance to providing it. I think that is because I pay attention not just to what I am told but to why.$$,
  q_proudest_moment = $$A patient on my ward was very close to another patient who died suddenly. She was devastated and the clinical team were occupied with the emergency. I sat with her for forty minutes, said very little, and made sure she had someone with her until the chaplain arrived. She later wrote to the ward to say that moment had stayed with her.$$,
  q_skills_equipment = $$I have experience supporting patients through bereavement and sudden loss reactions, completing emotional support documentation, liaising with chaplaincy and counselling services under nurse coordination, and completing personal care for patients with acute grief responses.$$
WHERE client_code = 'NHS498AL';

