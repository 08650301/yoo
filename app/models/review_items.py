from app import db

# --- 动态表格模型 ---

class KeyTechIndicator(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    product_name = db.Column(db.String(200))
    tech_spec = db.Column(db.Text)
    requirement = db.Column(db.Text)
    notes = db.Column(db.Text)


class BizReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    step = db.Column(db.String(50))
    category = db.Column(db.String(50))


class TechReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    step = db.Column(db.String(50))
    category = db.Column(db.String(50))


class ServiceReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    step = db.Column(db.String(50))
    category = db.Column(db.String(50))


class PriceReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    category = db.Column(db.String(50))


class DeductReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
