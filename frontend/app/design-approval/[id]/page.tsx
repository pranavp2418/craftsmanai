import ApprovalPage from './ApprovalPage';

export async function generateStaticParams() {
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
  ];
}

export default async function DesignApprovalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApprovalPage designId={id} />;
}
