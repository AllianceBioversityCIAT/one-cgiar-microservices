DEFAULT_PROMPT = """
Analyze the provided document(s) and extract all results related only to these indicators:
- “Capacity Sharing for Development”
- “Policy Change”

If no relevant information for either indicator is found, do not assume or invent data. Instead, return a JSON object with an empty array of results, like this:
{
    "results": []
}

---

Instructions for Each Identified Result

Indicator Type
Determine whether the result is:
1. Capacity Sharing for Development
- Involves individual and group activities and engagement aimed at changing knowledge, attitudes, skills, or practices.
- Capacity development refers to activities that develop the know-how and capacity to design, test, validate and use innovations. These activities are considered instrumental to lead to behavioral changes in knowledge, attitude, skills, and practice among CGIAR and non-CGIAR personnel.
- The main goal is to capture gender composition, and the number of people trained long-term and short term (including Masters’ and PhD students) by Alliance staff.
- Examples: training-of-trainers programs at the farmer level; providing guidance on RBM and MEL; training programs with public and private sector partners; educating PhD and MSc students; ongoing institutional support to national partners, particularly NARES; and decision support for policymakers.
- Possible keywords: "capacity", "capacitated", "capacity sharing", "capacity building", "training", "trained", "trainee", "trainees", "trainer", "students", "workshop", "webinar", "in-person", "hybrid", "online", "attendance", "attended", "attendees", "sessions", "participation", "participants", "participated", "took part", "male", "female", "total", "male participants", "female participants", "men", "women", "learning", "facilitator", "mentor", "mentored", "instructor", "lecturer", "coach", "seminar", "conference", "e-learning", "program", "virtual", "engagement", "feedback", "skills", "skills development", "knowledge transfer", "learning", "supervisor", "capacity development", "programme", "degree", "masters", "university", "bachelor", "on-site"

2. Policy Change
- Refers to introductions or modifications of policies, strategies, or regulations addressing specific issues.
- Must show measurable impacts or outcomes aligned with the project/organization’s goals.

---

General Information Fields

Result Title
- Identify the exact title of the result as stated in the document.

Result Description
- Provide a brief description of the result.

Keywords
- List relevant keywords in lowercase, as an array of strings.

Geoscope (Geographical Scope)
For each result, specify:
- level:
  - "Global"
  - "Regional"
  - "National"
  - "Sub-national"
  - "This is yet to be determined"
- sub_list:  
  - If level = "Regional", return an array with the appropriate UN M49 code(s).
  - If level = "National", return an array with the ISO Alpha-2 country code(s) (e.g., ["KE"]).
  - If level = "Sub-national", return an array with the specific sub-national areas (e.g., ["Western Kenya"]).
  - If not applicable, set "sub_list": null.

Additional Field for All Results:
- alliance_main_contact_person

---

Additional Requirements for "Capacity Sharing for Development"

Training Type
- "Individual training"
- "Group training"

If "Group training", **validate and reinforce participant counting by ensuring:**
1. Extract the full list of participants if available (e.g., from an appendix or table of attendees).
2. Use explicit participant counts if stated in the document.
3. If total_participants is present but gender-specific counts are missing, assume:
{
    "male_participants": 0,
    "female_participants": 0,
    "non_binary_participants": 0
}
4. If participant names are listed with gender annotations, count them directly from the list.
5. Ensure that:
   total_participants == male_participants + female_participants + non_binary_participants
   - If this condition is **not met**, **adjust total_participants to reflect the correct sum**.
6. All participant counts must be non-negative integers (≥ 0).

Training Duration Validation
- "Start date" and "End date" should capture the training period as stated in the document.
- "Length of training" should be calculated as the time elapsed between the Start date and the End date.
- If either date is missing, return "Not collected" for the start date, end date, and length of training.
- Long-term training refers to any training that goes for 3 or more months.
- Short-term training refers to any training that goes for less than 3 months.
- Only training programs that have been completed (end date in the past) should be reported.

For any fields (training_modality, start_date, end_date, length_of_training) not present in the document, return "Not collected".

---

Output Format
Your output must be valid JSON and must not include any additional text or explanations. Follow this structure exactly:

{
    "results": [
        {
            "indicator": "<'Capacity Sharing for Development' or 'Policy Change'>",
            "title": "<result title>",
            "description": "<result description>",
            "keywords": [
                "<keyword1>",
                "<keyword2>",
                "..."
            ],
            "geoscope": {
                "level": "<Global | Regional | National | Sub-national | This is yet to be determined>",
                "sub_list": <[array of codes or region names] or null>
            },
            "training_type": "<Individual training or Group training (only if applicable)>",
            "total_participants": <number (only if group training)>,
            "male_participants": <number (only if group training)>,
            "female_participants": <number (only if group training)>,
            "non_binary_participants": <number (only if group training)>,
            "training_modality": "<value or 'Not collected'>",
            "start_date": "<value or 'Not collected'>",
            "end_date": "<value or 'Not collected'>",
            "length_of_training": "<calculated value or 'Not collected'>",
            "alliance_main_contact_person": "<value or 'Not collected'>"
        }
    ]
}

If no results match the indicators, return exactly:

{
    "results": []
}
"""
