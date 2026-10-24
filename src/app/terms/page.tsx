import Shell from "@/components/Shell";
import BottomNav from "@/components/BottomNav";

export default function TermsPage() {
  return (
    <>
      <Shell title="用户协议" back hideNav>
        <article className="space-y-5 bg-white px-4 py-5 text-[13.5px] leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">一、服务说明</h2>
            <p>
              「搭子」（以下简称"本平台"）是面向大连理工大学盘锦校区同学的轻量信息发布平台，
              用于约自习、约运动、拼车回家、组队比赛等短期组队活动的信息撮合。
              本平台由学生自建运营，非学校官方平台，与学校官方无隶属或代理关系。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">二、账号与认证</h2>
            <p>
              1. 用户需通过学校邮箱或学号完成认证后方可发帖、报名。
            </p>
            <p>
              2. 用户应保证注册信息真实、准确，不得冒用他人身份。
            </p>
            <p>
              3. 账号仅限本人使用，不得出借、转让或用于违规活动。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">三、拼车特别约定</h2>
            <p>
              1. 本平台拼车服务仅提供信息撮合，<b>严禁任何形式的盈利或抽成</b>。
            </p>
            <p>
              2. 拼车费用仅限于油费、过路费、停车费等实际成本，按参与者合理分摊，
              不得高于市场合理价格。
            </p>
            <p>
              3. 拼车行程、路线、时间由双方自行协商确定，
              驾驶人须持有合法有效驾驶证，车辆须具备合法行驶条件。
            </p>
            <p>
              4. 平台不对拼车行程中的任何交通事故、财物损失、人身伤害承担责任。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">四、风险自担</h2>
            <p>
              1. 参加体育运动、比赛等活动存在人身伤害风险，
              用户应自行评估身体状况并做好安全防护，<b>风险自担</b>。
            </p>
            <p>
              2. 用户应遵守学校场馆管理规定与场地开放时间。
            </p>
            <p>
              3. 因用户自身原因造成的财产损失或人身伤害，由用户自行承担相应责任。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">五、用户行为规范</h2>
            <p>用户不得发布以下内容：</p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li>违反法律法规的内容</li>
              <li>虚假信息、诈骗信息、商业广告</li>
              <li>侮辱、骚扰、歧视他人的内容</li>
              <li>色情、低俗、暴力内容</li>
              <li>侵犯他人隐私或知识产权的内容</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">六、内容治理</h2>
            <p>
              1. 本平台采用"先发后审"机制：帖子发布后即时可见，
              通过敏感词过滤与用户举报进行事后治理。
            </p>
            <p>
              2. 用户可对违规帖子、用户进行举报，管理员将及时核实处理。
            </p>
            <p>
              3. 违规用户将被限制或封禁账号，情节严重的永久封禁。
            </p>
            <p>
              4. 违规内容将被下架，帖子归档保留 30 天后自动删除；
              涉及举报纠纷的内容保留至处理完毕。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">七、频率限制</h2>
            <p>
              为维护平台秩序，每个账号每日发帖不超过 5 条、报名不超过 20 次、
              留言不超过 50 条。系统将自动拦截超出部分。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">八、知识产权</h2>
            <p>
              用户在本平台发布的内容版权归用户所有。
              本平台名称、标识及相关权利归开发者所有。
              未经授权，不得使用学校名称、校徽等标识用于商业用途或可能造成混淆的用途。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">九、免责声明</h2>
            <p>
              1. 本平台按"现状"提供，不对信息的真实性、完整性、准确性作出保证。
            </p>
            <p>
              2. 用户之间的任何纠纷、损失，本平台不承担责任，
              但愿协助提供必要的信息支持。
            </p>
            <p>
              3. 因不可抗力、网络故障、系统维护等原因导致服务中断的，
              本平台不承担责任。
            </p>
            <p>
              4. 本平台有权根据运营需要调整、暂停或终止服务，并提前予以公告。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">十、协议更新</h2>
            <p>
              本协议可能不时更新，更新后将在平台内公示。
              继续使用本平台即视为接受更新后的协议。
            </p>
          </section>

          <p className="pt-2 text-center text-[11.5px] text-slate-400">
            使用本平台即表示你已阅读并同意上述条款
          </p>
        </article>
      </Shell>
      <BottomNav />
    </>
  );
}
