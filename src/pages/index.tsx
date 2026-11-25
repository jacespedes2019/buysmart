import BuySmart from "../buysmart/BuySmart";
import { Seo } from "../components/Seo";
import { seo } from "../seo";
export default function Index() {
  return (
    <div data-testid="static-landing">
      <Seo {...seo} path="/" />
      <BuySmart />
    </div>
  );
}
