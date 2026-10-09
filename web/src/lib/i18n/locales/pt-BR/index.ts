import agents from "./agents.json";
import assets from "./assets.json";
import auth from "./auth.json";
import chat from "./chat.json";
import common from "./common.json";
import dashboard from "./dashboard.json";
import findings from "./findings.json";
import interception from "./interception.json";
import legal from "./legal.json";
import llm from "./llm.json";
import mcp from "./mcp.json";
import navigation from "./navigation.json";
import notifications from "./notifications.json";
import settings from "./settings.json";
import tasks from "./tasks.json";
import tools from "./tools.json";
import traffic from "./traffic.json";
import workspace from "./workspace.json";

// Catalogs are grouped by UI area; common actions live in common.json.
const dictionary: Record<string, string> = {
  ...common,
  ...legal,
  ...navigation,
  ...auth,
  ...chat,
  ...tasks,
  ...assets,
  ...findings,
  ...traffic,
  ...workspace,
  ...agents,
  ...llm,
  ...interception,
  ...notifications,
  ...mcp,
  ...tools,
  ...settings,
  ...dashboard,
};

export default dictionary;
