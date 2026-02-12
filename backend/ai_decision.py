import os

import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from google import genai
from models import SimulationState

# Configure logger
logger = logging.getLogger(__name__)


# Define Pydantic models for structured output
class Reassignment(BaseModel):
    robot_id: str
    new_mission_id: str


class Decision(BaseModel):
    priority_mission_id: Optional[str] = Field(
        description="ID of the most critical mission to focus on"
    )
    reassignments: List[Reassignment] = Field(
        description="List of robot reassignments to optimize fleet"
    )
    reasoning: str = Field(description="Explanation of the decision")


def make_decision(state: SimulationState) -> Optional[Decision]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment variables.")
        return None

    try:
        client = genai.Client(api_key=api_key)

        # Construct prompt from state
        prompt = f"""
        You are the AI Commander of a robot fleet.
        Current Simulation Step: {state.step}
        
        Active Ops:
        - Robots: {len(state.robots)}
        - Active Missions: {len(state.active_missions)}
        
        Analyze the following state and decide on the next best action.
        Prioritize high-priority missions and ensure efficient battery usage.
        
        State Data:
        {state.model_dump_json()}
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",  # efficient model for this task
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": Decision,
            },
        )

        decision = response.parsed
        return decision

    except Exception as e:
        logger.error(f"Error calling Gemini AI: {e}")
        return None
