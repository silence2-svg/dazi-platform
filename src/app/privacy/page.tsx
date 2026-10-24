import Shell from "@/components/Shell";
import BottomNav from "@/components/BottomNav";

export default function PrivacyPage() {
  return (
    <>
      <Shell title="隐私政策" back hideNav>
        <article className="space-y-5 bg-white px-4 py-5 text-[13.5px] leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">一、我们收集的信息</h2>
            <p>本平台仅收集为提供服务所必需的信息：</p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li><b>账号信息</b>：邮箱或学号、昵称、密码哈希（加密存储）</li>
              <li><b>资料信息</b>：头像、年级、书院（均为选填）</li>
              <li><b>联系方式</b>：微信号或手机号（选填，默认不公开）</li>
              <li><b>行为数据</b>：发布的帖子、报名记录、通知消息</li>
            </ul>
            <p className="mt-1.5 text-slate-500">
              我们不收集你的通讯录、相册、位置轨迹等敏感信息。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">二、联系方式可见性</h2>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              <p className="text-[13px] font-medium">默认不公开</p>
              <p className="mt-1 text-[12.5px] leading-relaxed">
                你的联系方式默认仅自己可见。
                <b>只有在报名被确认后</b>，才会向你和对方同时展示。
                你也可以随时在「设置」中选择不公开。
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">三、信息的使用</h2>
            <p>我们使用上述信息用于：</p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li>完成身份认证，确保用户为校内同学</li>
              <li>展示帖子与报名信息，实现活动撮合</li>
              <li>发送站内通知与活动提醒</li>
              <li>维护社区秩序，处理举报与违规内容</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">四、推送通知</h2>
            <p>
              站内通知为核心功能，一定可用。
              若你授权开启 Web Push，我们会在活动开始前 1 天和 1 小时向你发送提醒。
              你可以随时在「消息」页关闭推送。
            </p>
            <p className="mt-1.5 text-slate-500">
              我们不会在你未同意的情况下向第三方共享你的推送订阅信息。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">五、信息的共享</h2>
            <p>
              我们<b>不出售、不共享</b>你的个人信息给任何第三方，
              除以下情形外：
            </p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li>获得你的明确同意</li>
              <li>依据法律法规、司法或行政机关的强制要求</li>
              <li>为保护平台及用户合法权益所必需</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">六、数据保留与删除</h2>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li>活动结束，帖子自动下架归档，不再显示在大厅</li>
              <li>归档内容保留 30 天，之后自动物理删除</li>
              <li>涉及举报或纠纷的内容，保留至处理完毕</li>
              <li>你可以随时申请注销账号并删除个人数据</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">七、数据安全</h2>
            <p>
              密码采用不可逆的哈希算法存储，平台无法获取你的明文密码。
              生产环境下全站使用 HTTPS 加密传输。
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">八、你的权利</h2>
            <p>你有权：</p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li>查看和修改个人资料（设置页）</li>
              <li>设置联系方式的可见范围</li>
              <li>拉黑其他用户</li>
              <li>举报违规内容</li>
              <li>注销账号并删除数据</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-[15px] font-semibold text-slate-900">九、未成年人保护</h2>
            <p>
              本平台面向在校大学生开放。若使用者为未成年人，
              请在监护人指导下使用。
            </p>
          </section>

          <p className="pt-2 text-center text-[11.5px] text-slate-400">
            如对本政策有任何疑问，欢迎通过平台反馈
          </p>
        </article>
      </Shell>
      <BottomNav />
    </>
  );
}
