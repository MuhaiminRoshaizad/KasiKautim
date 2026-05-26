import { CreateBillFormIsland } from "./create-bill-form";

export const metadata = {
  title: "New bill",
};

export default function NewBillPage() {
  return (
    <div className="mx-auto max-w-xl">
      <CreateBillFormIsland />
    </div>
  );
}
