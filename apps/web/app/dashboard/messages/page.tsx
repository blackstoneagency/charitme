import { KindFundShell, TopBar, Avatar, KFIcon } from '../../../components/KindFundApp';

const conversations = ['James Miller', 'Sophia Chen', 'Michael Brown', 'Emily Davis', 'David Wilson', 'Lisa White', 'Olivia Martinez', 'KindFund Support'];

export default function MessagesPage() {
  return (
    <KindFundShell active="Messages">
      <TopBar title="Messages" subtitle="Communicate with your supporters and build stronger connections." />
      <div className="kf-messages">
        <section className="kf-card kf-inbox">
          <div className="kf-tabs"><button className="active">Inbox (8)</button><button>Unread (8)</button><button>Archived</button></div>
          <label className="kf-search"><KFIcon name="search" /><input placeholder="Search conversations..." /></label>
          {conversations.map((name, i) => (
            <article key={name} className={i === 0 ? 'active' : ''}><Avatar name={name} /><div><strong>{name}</strong><p>{i === 0 ? "Thanks for the update! I'm so glad to hear Mia is doing better." : 'Can you share more details?'}</p></div><span>{i < 2 ? i + 1 : ''}</span></article>
          ))}
        </section>
        <section className="kf-card kf-thread">
          <div className="kf-thread-head"><Avatar name="James Miller" /><div><h2>James Miller <span>Donor</span></h2><p>james.miller@gmail.com • +1 (555) 123-4567</p></div></div>
          {[
            ['James Miller', 'Hi Sarah, I just wanted to check in and see how Mia is doing after her surgery.', 'left'],
            ['Sarah Thompson', 'Hi James! Mia is recovering really well, thank you so much for asking. The surgery was successful and she is now resting comfortably.', 'right'],
            ['James Miller', "That's amazing news! Thank you for keeping us updated. You and your team are doing such an incredible job.", 'left'],
            ['Sarah Thompson', "We couldn't do this without supporters like you. Thank you so much for being part of Mia's journey!", 'right'],
          ].map(([name, text, side]) => <div key={text} className={`kf-bubble ${side}`}><Avatar name={name} /><p>{text}<small>10:18 AM</small></p></div>)}
          <div className="kf-composer"><textarea placeholder="Type your message..." /><button><KFIcon name="send" /> Send</button></div>
        </section>
        <aside className="kf-side-panels"><section className="kf-card"><h2>Contact Details</h2>{['james.miller@gmail.com', '+1 (555) 123-4567', 'New York, NY, USA', 'Total Donations $1,250.00'].map((x) => <p className="kf-detail" key={x}>{x}</p>)}</section></aside>
      </div>
    </KindFundShell>
  );
}
